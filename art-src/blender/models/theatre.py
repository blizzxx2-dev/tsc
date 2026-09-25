"""
The operating theatre (story/menu set): an anatomical theatre in the manner of Padua and Leiden.
A heavy oak table under a wrought-iron candle wheel at the centre; four horseshoe galleries of
turned balusters rising behind it; a stone drum wall with plastered upper storey, tall arched
windows and a timber ceiling. Exported as assets/models/set-theatre.glb with anchors:

  cam, cam.target        the default camera (extras: fov in degrees)
  key, key.target        the shadowed lamp light over the table (extras: color, intensity, cone, range)
  candle.N               point lights at the candle flames (extras: color, intensity, range)
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
from common import (box, box_uv, cylinder, empty, export, finish, flat, lathe, mesh_object, pbr, preview, reset, srgb, transform, tube)  # noqa: E402


def mats():
    return {
        'floor': pbr('floor', 'monastery_stone_floor', tint=(0.78, 0.72, 0.66)),
        'stone': pbr('stone', 'medieval_blocks_02', tint=(0.74, 0.68, 0.6)),
        'plaster': pbr('plaster', 'worn_plaster_wall', tint=(0.78, 0.7, 0.58)),
        'oak': pbr('oak', 'dark_wood', tint=(0.62, 0.5, 0.4)),
        'timber': pbr('timber', 'medieval_wood', tint=(0.55, 0.45, 0.36)),
        'table': pbr('table', 'wood_table_worn', tint=(0.7, 0.58, 0.46)),
        'linen': pbr('linen', 'rough_linen', tint=(0.86, 0.8, 0.7), size=1024, sss=0.3),
        'leather': pbr('leather', 'brown_leather', tint=(0.7, 0.55, 0.42)),
        'iron': pbr('iron', 'rusty_metal_02', tint=(0.45, 0.4, 0.36)),
        'wax': flat('wax', srgb('#e8dcb8'), roughness=0.45, sss=0.8),
        'flame': flat('flame', srgb('#ffcc80'), roughness=1.0, emission=srgb('#ffb060'), emission_strength=24.0, flicker=0.7),
        'ember': flat('coals', srgb('#3a1a10'), roughness=0.9, emission=srgb('#ff4a10'), emission_strength=3.0, flicker=0.5),
        'glass': flat('window', srgb('#3a4a66'), roughness=0.2, emission=srgb('#5a78b0'), emission_strength=0.6),
        'lead': flat('lead', srgb('#1a1a1c'), metallic=1.0, roughness=0.6),
        'brass': flat('brass', srgb('#c89a4a'), metallic=1.0, roughness=0.35),
    }


def arc_band(name, r0, r1, z0, z1, a0, a1, segs, mat, uv=1.5):
    """A thick curved band (gallery floor, rail, wall ring) between radii r0..r1 and heights z0..z1."""
    bm = bmesh.new()
    rings = []
    for i in range(segs + 1):
        a = a0 + (a1 - a0) * i / segs
        c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((r0 * c, r0 * s, z0)), bm.verts.new((r1 * c, r1 * s, z0)), bm.verts.new((r1 * c, r1 * s, z1)), bm.verts.new((r0 * c, r0 * s, z1))])
    for p, q in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((p[k], q[k], q[(k + 1) % 4], p[(k + 1) % 4]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_object(name, bm, mat, smooth=False, auto_smooth=None)
    box_uv(o, uv)
    return o


def baluster(mat):
    return lathe('baluster', [(0.0, 0.0), (0.05, 0.0), (0.05, 0.05), (0.035, 0.08), (0.055, 0.2), (0.06, 0.32), (0.04, 0.46), (0.028, 0.56), (0.042, 0.62), (0.045, 0.68), (0.0, 0.68)], 48, mat)


def gallery(M, r, z, span=(math.radians(-20), math.radians(200))):
    """One horseshoe gallery tier: standing floor, balustrade, handrail, a bench row."""
    a0, a1 = span
    parts = [arc_band('gallery-floor', r, r + 0.72, z - 0.14, z, a0, a1, 120, M['timber'], 1.2)]
    parts.append(arc_band('gallery-face', r - 0.02, r + 0.02, z - 0.95 if z > 0.2 else 0, z - 0.14, a0, a1, 120, M['oak'], 1.2))
    parts.append(arc_band('rail', r - 0.07, r + 0.07, z + 0.72, z + 0.8, a0, a1, 144, M['oak'], 0.8))
    parts.append(arc_band('rail-base', r - 0.06, r + 0.06, z, z + 0.05, a0, a1, 144, M['oak'], 0.8))
    count = int(r * (a1 - a0) / 0.2)
    proto = baluster(M['oak'])
    for i in range(count + 1):
        a = a0 + (a1 - a0) * i / count
        b = proto.copy()
        b.data = proto.data
        bpy.context.scene.collection.objects.link(b)
        b.location = (r * math.cos(a), r * math.sin(a), z + 0.04)
        parts.append(b)
    parts.append(proto)
    proto.location = (1000, 0, 0)
    proto.hide_render = True
    parts.pop()
    bpy.data.objects.remove(proto, do_unlink=True)
    # Posts at intervals, capped with a turned finial.
    for i in range(0, 9):
        a = a0 + (a1 - a0) * i / 8
        p = box('post', (0.14, 0.14, 0.95), loc=(r * math.cos(a), r * math.sin(a), z + 0.44), mat=M['oak'], bevel_w=0.01)
        f = lathe('finial', [(0.0, 0.0), (0.06, 0.0), (0.07, 0.03), (0.04, 0.08), (0.055, 0.13), (0.0, 0.2)], 48, M['oak'])
        f.location = (r * math.cos(a), r * math.sin(a), z + 0.92)
        parts += [p, f]
    return parts


def table(M):
    parts = [box('tabletop', (2.1, 0.86, 0.1), loc=(0, 0, 0.86), mat=M['table'], bevel_w=0.012)]
    box_uv(parts[0], 1.0)
    apron = box('apron', (1.9, 0.7, 0.14), loc=(0, 0, 0.74), mat=M['oak'], bevel_w=0.008)
    box_uv(apron, 1.0)
    parts.append(apron)
    for sx in (-0.88, 0.88):
        for sy in (-0.33, 0.33):
            leg = lathe('leg', [(0.0, 0.0), (0.07, 0.0), (0.075, 0.06), (0.05, 0.1), (0.065, 0.3), (0.075, 0.42), (0.05, 0.56), (0.06, 0.62), (0.055, 0.68), (0.0, 0.68)], 48, M['oak'])
            leg.location = (sx, sy, 0)
            parts.append(leg)
    stretcher = box('stretcher', (1.8, 0.07, 0.07), loc=(0, 0, 0.16), mat=M['oak'])
    parts.append(stretcher)
    # A linen sheet over the top, hanging over the long edges with a soft fold.
    bm = bmesh.new()
    nx, ny = 36, 16
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u = i / nx
            v = j / ny
            x = -1.12 + 2.24 * u
            y = -0.66 + 1.32 * v
            z = 0.915
            over = max(0.0, abs(y) - 0.43)
            z -= over * 1.4
            y = math.copysign(min(abs(y), 0.45 + over * 0.18), y) if over > 0 else y
            z += 0.008 * math.sin(u * 23 + v * 7) * (0.3 + over * 4)
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    sheet = mesh_object('sheet', bm, M['linen'], auto_smooth=None)
    box_uv(sheet, 0.9)
    bpy.context.view_layer.objects.active = sheet
    solid = sheet.modifiers.new('thick', 'SOLIDIFY')
    solid.thickness = 0.006
    parts.append(sheet)
    # Leather restraint straps across the sheet with iron buckles.
    for x in (-0.55, 0.45):
        parts.append(box('strap', (0.07, 0.96, 0.012), loc=(x, 0, 0.93), mat=M['leather']))
        parts.append(box('buckle', (0.06, 0.05, 0.02), loc=(x, -0.3, 0.94), mat=M['iron']))
    # A folded cloth and a brass basin at the foot.
    basin = lathe('basin', [(0.0, 0.0), (0.12, 0.0), (0.2, 0.06), (0.22, 0.07), (0.2, 0.072), (0.0, 0.072)], 96, M['brass'])
    basin.location = (0.78, 0.18, 0.93)
    parts.append(basin)
    return parts


def candle_wheel(M, z=3.3, r=0.85, n=8):
    """A wrought-iron wheel of candles hung over the table."""
    parts = [tube('wheel', [(r * math.cos(a), r * math.sin(a), z) for a in [i * 2 * math.pi / 48 for i in range(49)]], 0.022, M['iron'])]
    for i in range(n):
        a = i * 2 * math.pi / n
        parts.append(tube('spoke', [(0, 0, z), (r * math.cos(a), r * math.sin(a), z)], 0.012, M['iron']))
        parts.append(tube('chain', [(r * math.cos(a) * 0.9, r * math.sin(a) * 0.9, z), (0, 0, z + 1.6)], 0.006, M['iron']))
        cx, cy = r * math.cos(a), r * math.sin(a)
        cup = lathe('cup', [(0.0, 0.0), (0.05, 0.0), (0.06, 0.03), (0.0, 0.03)], 48, M['iron'])
        cup.location = (cx, cy, z)
        h = 0.18 + 0.06 * random.random()
        wax = lathe('candle', [(0.0, 0.0), (0.028, 0.0), (0.026, h * 0.9), (0.022, h), (0.0, h)], 48, M['wax'])
        wax.location = (cx, cy, z + 0.03)
        flame = lathe('flame', [(0.0, 0.0), (0.009, 0.012), (0.011, 0.028), (0.006, 0.05), (0.0, 0.07)], 48, M['flame'])
        flame.location = (cx, cy, z + 0.035 + h)
        empty(f'candle.{i}', (cx, cy, z + 0.07 + h), color=[1.0, 0.62, 0.3], intensity=1.6, range=6.0)
        parts += [cup, wax, flame]
    hub = lathe('hub', [(0.0, -0.15), (0.06, -0.12), (0.08, 0.0), (0.05, 0.1), (0.0, 0.14)], 48, M['iron'])
    hub.location = (0, 0, z)
    parts.append(hub)
    return parts


def standing_candle(M, x, y, i):
    stand = lathe('stand', [(0.0, 0.0), (0.2, 0.0), (0.16, 0.05), (0.04, 0.1), (0.03, 1.3), (0.09, 1.34), (0.09, 1.38), (0.0, 1.38)], 48, M['iron'])
    stand.location = (x, y, 0)
    wax = lathe('candle', [(0.0, 0.0), (0.045, 0.0), (0.043, 0.3), (0.036, 0.33), (0.0, 0.33)], 48, M['wax'])
    wax.location = (x, y, 1.38)
    flame = lathe('flame', [(0.0, 0.0), (0.012, 0.016), (0.015, 0.036), (0.008, 0.064), (0.0, 0.09)], 48, M['flame'])
    flame.location = (x, y, 1.72)
    empty(f'candle.s{i}', (x, y, 1.78), color=[1.0, 0.58, 0.28], intensity=2.2, range=5.0)
    return [stand, wax, flame]


def brazier(M, x, y):
    bowl = lathe('brazier', [(0.0, 0.62), (0.34, 0.66), (0.4, 0.78), (0.42, 0.8), (0.0, 0.8)], 72, M['iron'], close_top=False)
    bowl.location = (x, y, 0)
    coals = lathe('coals', [(0.0, 0.0), (0.37, 0.0), (0.3, 0.06), (0.0, 0.1)], 60, M['ember'])
    coals.location = (x, y, 0.72)
    legs = [tube('brazier-leg', [(x + 0.3 * math.cos(a), y + 0.3 * math.sin(a), 0.66), (x + 0.42 * math.cos(a), y + 0.42 * math.sin(a), 0.0)], 0.022, M['iron']) for a in (0.3, 2.4, 4.5)]
    empty('candle.brazier', (x, y, 0.95), color=[1.0, 0.4, 0.14], intensity=3.0, range=5.0)
    return [bowl, coals, *legs]


def walls(M, r=7.2):
    parts = [arc_band('wall-stone', r, r + 0.6, 0.0, 3.6, 0, 2 * math.pi, 192, M['stone'], 2.2)]
    parts.append(arc_band('wall-cornice', r - 0.12, r + 0.1, 3.6, 3.85, 0, 2 * math.pi, 192, M['oak'], 1.2))
    upper = arc_band('wall-plaster', r, r + 0.6, 3.85, 9.5, 0, 2 * math.pi, 192, M['plaster'], 3.0)
    parts.append(upper)
    # Tall arched windows in the upper storey, glazed with moonlight, with stone surrounds.
    for i in range(10):
        a = math.radians(-60 + i * 36)
        c, s = math.cos(a), math.sin(a)
        rr = r - 0.03
        bm = bmesh.new()
        pts = [(-0.55, 4.6), (0.55, 4.6), (0.55, 7.4)] + [(0.55 * math.cos(t), 7.4 + 0.55 * math.sin(t)) for t in [math.pi * k / 10 for k in range(1, 10)]] + [(-0.55, 7.4)]
        vs = [bm.verts.new((rr * c - px * s, rr * s + px * c, pz)) for px, pz in pts]
        bm.faces.new(list(reversed(vs)))
        win = mesh_object('window', bm, M['glass'], smooth=False, auto_smooth=None)
        parts.append(win)
        for px in (-0.2, 0.2):
            parts.append(tube('came', [(rr * c - px * s - 0.01 * c, rr * s + px * c - 0.01 * s, 4.6), (rr * c - px * s - 0.01 * c, rr * s + px * c - 0.01 * s, 7.8)], 0.012, M['lead']))
        for pz in (5.3, 6.0, 6.7):
            parts.append(tube('came', [(rr * c + 0.55 * s - 0.01 * c, rr * s - 0.55 * c - 0.01 * s, pz), (rr * c - 0.55 * s - 0.01 * c, rr * s + 0.55 * c - 0.01 * s, pz)], 0.012, M['lead']))
        sill = box('sill', (0.3, 1.4, 0.12), mat=M['stone'], bevel_w=0.01)
        transform(sill, (rr * c - 0.1 * c, rr * s - 0.1 * s, 4.55), (0, 0, a))
        parts.append(sill)
    return parts


def ceiling(M, r=7.8):
    parts = [arc_band('ceiling', 0.0, r, 9.5, 9.7, 0, 2 * math.pi, 144, M['plaster'], 3.0)]
    for i in range(16):
        a = i * math.pi / 8
        b = box('beam', (r * 2, 0.26, 0.34), mat=M['timber'], bevel_w=0.015)
        transform(b, (0, 0, 9.33), (0, 0, a))
        box_uv(b, 2.0)
        parts.append(b)
    ring = arc_band('beam-ring', 2.2, 2.6, 9.0, 9.5, 0, 2 * math.pi, 144, M['timber'], 1.5)
    parts.append(ring)
    return parts


def merge_by_material(objs):
    """One mesh per material: a handful of draw calls for the whole set."""
    by = {}
    for o in objs:
        if o.type != 'MESH' or not o.data.materials:
            continue
        by.setdefault(o.data.materials[0].name, []).append(o)
    for name, group in by.items():
        for o in group:
            if o.data.users > 1:
                o.data = o.data.copy()
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        bpy.context.view_layer.objects.active.name = f'set-{name}'


def main():
    reset(seed=3)
    M = mats()
    floor = arc_band('floor', 0.0, 7.8, -0.1, 0.0, 0, 2 * math.pi, 192, M['floor'], 2.5)
    objs = [floor]
    objs += table(M)
    # Galleries: the horseshoe opens toward the camera (-Y).
    for k, r in enumerate((2.6, 3.4, 4.2, 5.0)):
        objs += gallery(M, r, 0.2 + k * 0.95)
    # Raked gallery backs (so the tiers read as solid stepped risers).
    for k, r in enumerate((3.4, 4.2, 5.0, 5.8)):
        objs.append(arc_band('riser', r - 0.1, r - 0.06, 0.0, 0.2 + k * 0.95, math.radians(-20), math.radians(200), 120, M['oak'], 1.2))
    objs += candle_wheel(M)
    objs += standing_candle(M, -1.7, -1.3, 0) + standing_candle(M, 1.7, -1.3, 1)
    objs += brazier(M, -1.9, 0.9)
    objs += walls(M) + ceiling(M)
    # Camera and the lamp's key light.
    empty('cam', (0.0, -5.6, 2.1), fov=46)
    empty('cam.target', (0.0, 0.9, 1.35))
    empty('key', (0.0, -0.2, 3.25), color=[1.0, 0.7, 0.42], intensity=22.0, cone=math.radians(75), range=9.0)
    empty('key.target', (0.0, 0.0, 0.9))
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH':
            o.select_set(False)
    merge_by_material([o for o in bpy.context.scene.objects if o.type == 'MESH'])
    export('set-theatre')
    print('built set-theatre')
    lights = [{'type': 'SPOT', 'loc': (0.0, -0.2, 3.25), 'target': (0, 0, 0.9), 'energy': 900, 'color': (1.0, 0.7, 0.42), 'spot': math.radians(80), 'soft': 0.4}]
    for o in bpy.context.scene.objects:
        if o.name.startswith('candle.'):
            lights.append({'type': 'POINT', 'loc': tuple(o.location), 'energy': 60 if o.name.startswith('candle.s') else 25, 'color': (1.0, 0.6, 0.3)})
    lights.append({'type': 'AREA', 'loc': (0.0, 6.0, 7.0), 'target': (0, 0, 0), 'energy': 400, 'color': (0.45, 0.55, 0.85), 'size': 6})
    preview('set-theatre', (0.0, -5.6, 2.1), (0.0, 0.9, 1.35), lens=30, lights=lights, samples=64)
    print('built set-theatre preview')


main()
finish()
