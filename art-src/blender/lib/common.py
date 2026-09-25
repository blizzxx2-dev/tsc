"""
Shared helpers for the scripted Blender asset pipeline (docs/art/pipeline.md, "3D assets").

Every asset is built from code: no hand-edited .blend files. A model script builds its scene with
these helpers, then calls `export(name)` (glTF binary into assets/models/) and `preview(name)`
(a Cycles render into docs/art/renders/ for review). Runs headless under the `bpy` module:

    npm run art:models            # all models
    npm run art:models -- tools   # one script

Textures are CC0 (Poly Haven), fetched once into art-src/.cache/textures and re-encoded at the
resolution each asset needs; the licence list lives in art-src/textures.json.
"""
from __future__ import annotations

import json
import math
import os
import random
import urllib.request
from pathlib import Path

import bpy  # noqa: I001 (bpy must load before bmesh/mathutils)
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
CACHE = ROOT / 'art-src' / '.cache' / 'textures'
OUT = ROOT / 'assets' / 'models'
RENDERS = ROOT / 'docs' / 'art' / 'renders'
TEXTURES = json.loads((ROOT / 'art-src' / 'textures.json').read_text())


# ---------------------------------------------------------------- scene

def reset(seed: int = 1) -> None:
    """Empty scene, metric units, deterministic randomness."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    random.seed(seed)


def link(obj: bpy.types.Object, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name: str, loc=(0, 0, 0), **props) -> bpy.types.Object:
    """An anchor for the engine (camera, lights, slots). Custom properties export as glTF extras."""
    o = bpy.data.objects.new(name, None)
    o.location = loc
    for k, v in props.items():
        o[k] = v
    return link(o)


def mesh_object(name: str, bm: bmesh.types.BMesh, mat=None, smooth: bool = True, auto_smooth: float | None = 40.0) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    link(o)
    if mat is not None:
        me.materials.append(mat)
    if smooth and auto_smooth is not None:
        # Keep hard edges hard: split normals above the angle.
        mod = o.modifiers.new('smooth', 'EDGE_SPLIT')
        mod.split_angle = math.radians(auto_smooth)
        apply_modifiers(o)
    return o


def apply_modifiers(o: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.object.modifier_apply(modifier=m.name)


def bevel(o: bpy.types.Object, width: float, segments: int = 2) -> bpy.types.Object:
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.harden_normals = True
    apply_modifiers(o)
    return o


def join(objs: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    # Bake the parts' placement: the joined object starts with an identity transform.
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def transform(o: bpy.types.Object, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)) -> bpy.types.Object:
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    return o


# ---------------------------------------------------------------- geometry

def lathe(name: str, profile: list[tuple[float, float]], segments: int = 64, mat=None, close_top: bool = True, close_bottom: bool = True) -> bpy.types.Object:
    """Turn a (radius, height) profile around Z: pots, handles, candles, balusters, finials."""
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        ring = [bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile]
        rings.append(ring)
    for i in range(segments):
        a, b = rings[i], rings[(i + 1) % segments]
        for j in range(len(profile) - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    if close_bottom and profile[0][0] > 1e-5:
        bm.faces.new([r[0] for r in reversed(rings)])
    if close_top and profile[-1][0] > 1e-5:
        bm.faces.new([r[-1] for r in rings])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_object(name, bm, mat, auto_smooth=50)
    cylinder_uv(o)
    return o


def box(name: str, size, loc=(0, 0, 0), mat=None, bevel_w: float = 0.0) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    o = mesh_object(name, bm, mat, smooth=False, auto_smooth=None)
    if bevel_w > 0:
        bevel(o, bevel_w, 2)
    return o


def cylinder(name: str, r: float, h: float, loc=(0, 0, 0), mat=None, segs: int = 32, r2: float | None = None) -> bpy.types.Object:
    o = lathe(name, [(r, 0), (r if r2 is None else r2, h)], segs, mat)
    o.location = loc
    return o


def tube(name: str, points: list[tuple[float, float, float]], radius: float, mat=None, segs: int = 24, taper: list[float] | None = None) -> bpy.types.Object:
    """A swept circle along a poly-line path (tongs arms, thread, wire, straps)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (*p, 1)
        sp.points[i].radius = taper[i] if taper else 1.0
    cu.bevel_depth = radius
    cu.bevel_resolution = max(1, segs // 4)
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu)
    link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
        bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    for p in o.data.polygons:
        p.use_smooth = True
    if mat is not None:
        o.data.materials.append(mat)
    cylinder_uv(o)
    return o


def box_uv(o: bpy.types.Object, size: float = 1.0) -> None:
    """World-scale cube projection so textures keep one texel density across the set."""
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=size, scale_to_bounds=False, correct_aspect=True)
    bpy.ops.object.mode_set(mode='OBJECT')


def cylinder_uv(o: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cylinder_project(scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------- textures and materials

def _fetch(url: str, dest: Path) -> Path:
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': 'suture-and-steel-art-pipeline'})
        with urllib.request.urlopen(req, timeout=120) as r:
            dest.write_bytes(r.read())
    return dest


def texture_maps(tex_id: str, res: str = '4k') -> dict[str, Path]:
    """Download a Poly Haven texture set at full resolution: diffuse (JPEG), OpenGL normal and
    AO/rough/metal (lossless PNG)."""
    meta_path = CACHE / tex_id / 'files.json'
    if not meta_path.exists():
        meta_path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(f'https://api.polyhaven.com/files/{tex_id}', headers={'User-Agent': 'suture-and-steel-art-pipeline'})
        with urllib.request.urlopen(req, timeout=60) as r:
            meta_path.write_bytes(r.read())
    files = json.loads(meta_path.read_text())
    out = {}
    for key, name, fmt in (('Diffuse', 'diff', 'jpg'), ('nor_gl', 'nor', 'png'), ('arm', 'arm', 'png')):
        if key in files and res in files[key]:
            f = files[key][res].get(fmt) or files[key][res]['jpg']
            ext = 'png' if fmt in files[key][res] and fmt == 'png' else 'jpg'
            out[name] = _fetch(f['url'], CACHE / tex_id / f'{name}_{res}.{ext}')
    return out


def processed(src: Path, tag: str, tint=(1.0, 1.0, 1.0), gain: float = 1.0) -> Path:
    """A colour map with its grade baked in (glTF has no tint node), at full source resolution,
    saved near-losslessly (quality 97, no chroma subsampling). Untinted maps are used as-is."""
    from PIL import Image

    if tint == (1.0, 1.0, 1.0) and gain == 1.0:
        return src
    dest = src.with_name(f'{src.stem}.{tag}.jpg')
    if dest.exists():
        return dest
    im = Image.open(src).convert('RGB')
    if tint != (1.0, 1.0, 1.0) or gain != 1.0:
        r, g, b = im.split()
        r = r.point(lambda v: min(255, int(v * tint[0] * gain)))
        g = g.point(lambda v: min(255, int(v * tint[1] * gain)))
        b = b.point(lambda v: min(255, int(v * tint[2] * gain)))
        im = Image.merge('RGB', (r, g, b))
    im.save(dest, 'JPEG', quality=97, subsampling=0, optimize=True)
    return dest


def _gltf_output_group() -> bpy.types.NodeTree:
    """The node group the glTF exporter reads ambient occlusion from."""
    g = bpy.data.node_groups.get('glTF Material Output')
    if g is None:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def _image_node(nodes, path: Path, non_color: bool):
    n = nodes.new('ShaderNodeTexImage')
    img = bpy.data.images.load(str(path), check_existing=True)
    img.colorspace_settings.name = 'Non-Color' if non_color else 'sRGB'
    n.image = img
    return n


def pbr(name: str, tex_id: str, tint=(1.0, 1.0, 1.0), gain: float = 1.0, size: int | None = None, rough_scale: float = 1.0, normal_strength: float = 1.0, **extras) -> bpy.types.Material:
    """A textured metal/rough material from a CC0 set; `extras` become glTF material extras."""
    maps = texture_maps(tex_id)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes['Principled BSDF']
    if 'diff' in maps:
        d = _image_node(nodes, processed(maps['diff'], f'{name}', tint, gain), False)
        links.new(d.outputs['Color'], bsdf.inputs['Base Color'])
    if 'arm' in maps:
        a = _image_node(nodes, maps['arm'], True)
        sep = nodes.new('ShaderNodeSeparateColor')
        links.new(a.outputs['Color'], sep.inputs['Color'])
        links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
        links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
        grp = nodes.new('ShaderNodeGroup')
        grp.node_tree = _gltf_output_group()
        links.new(sep.outputs['Red'], grp.inputs['Occlusion'])
    if 'nor' in maps:
        nm = _image_node(nodes, maps['nor'], True)
        nn = nodes.new('ShaderNodeNormalMap')
        nn.inputs['Strength'].default_value = normal_strength
        links.new(nm.outputs['Color'], nn.inputs['Color'])
        links.new(nn.outputs['Normal'], bsdf.inputs['Normal'])
    for k, v in extras.items():
        m[k] = v
    return m


def flat(name: str, color, metallic: float = 0.0, roughness: float = 0.5, emission=None, emission_strength: float = 1.0, alpha: float = 1.0, **extras) -> bpy.types.Material:
    """An untextured material (polished steel, brass, glass, wax, flame)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if emission is not None:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = emission_strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
        m.surface_render_method = 'BLENDED'
    for k, v in extras.items():
        m[k] = v
    return m


def srgb(hexstr: str) -> tuple[float, float, float]:
    """'#rrggbb' → linear RGB (Blender colour inputs are linear)."""
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------------------------------------------------------------- output

def finish() -> None:
    """Exit without bpy's interpreter teardown, which can crash after a successful build."""
    import sys
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0)


def export(name: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'{name}.glb'
    # Triangulate on export (applied, non-destructive): n-gon caps break tangent generation.
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and not any(m.type == 'TRIANGULATE' for m in o.modifiers):
            o.modifiers.new('tri', 'TRIANGULATE')
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format='GLB',
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_cameras=False,
        export_lights=False,
        use_selection=False,
    )
    return path


def preview(name: str, cam_loc, cam_target, lens: float = 50, lights: list[dict] | None = None, size=(960, 540), samples: int = 48, world=(0.02, 0.018, 0.016)) -> Path:
    """A Cycles review render (not shipped): docs/art/renders/<name>.png."""
    RENDERS.mkdir(parents=True, exist_ok=True)
    s = bpy.context.scene
    cam = bpy.data.objects.new('preview-cam', bpy.data.cameras.new('preview-cam'))
    link(cam)
    cam.location = cam_loc
    d = Vector(cam_target) - Vector(cam_loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    s.camera = cam
    added = [cam]
    for i, l in enumerate(lights or [{'type': 'AREA', 'loc': (1.5, -1.5, 2.5), 'energy': 300, 'size': 1.5}]):
        ld = bpy.data.lights.new(f'preview-light-{i}', l.get('type', 'POINT'))
        ld.energy = l.get('energy', 100)
        ld.color = l.get('color', (1.0, 0.85, 0.65))
        if ld.type == 'AREA':
            ld.size = l.get('size', 1.0)
        if ld.type == 'SPOT':
            ld.spot_size = l.get('spot', math.radians(60))
            ld.shadow_soft_size = l.get('soft', 0.2)
        lo = bpy.data.objects.new(f'preview-light-{i}', ld)
        link(lo)
        lo.location = l['loc']
        if 'target' in l:
            lo.rotation_euler = (Vector(l['target']) - Vector(l['loc'])).to_track_quat('-Z', 'Y').to_euler()
        added.append(lo)
    s.world = bpy.data.worlds.new('preview-world')
    s.world.color = world
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = size
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    path = RENDERS / f'{name}.png'
    s.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    # Preview-only objects must not end up in a later export.
    for o in added:
        bpy.data.objects.remove(o, do_unlink=True)
    return path
