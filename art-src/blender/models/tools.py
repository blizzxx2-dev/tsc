"""
The surgeon's eight instruments (ART-0070 / 3D): lancet, tongs, leech-pipe, gut thread, saint's
salve, tincture syringe, cautery brand and scrying lens. Each is built along +X, lying in the XY
plane, at true scale (metres), and exported as assets/models/tool-<id>.glb. The engine renders
tray and cursor icons from these, lit by the same candle rig as the sets.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from common import (box, finish, cylinder, export, flat, join, lathe, link, mesh_object, pbr, preview, reset, srgb, transform, tube)  # noqa: E402


def materials():
    return {
        'steel': flat('steel', srgb('#c4c8ce'), metallic=1.0, roughness=0.24),
        'iron': flat('iron', srgb('#55524e'), metallic=1.0, roughness=0.55),
        'brass': flat('brass', srgb('#d4a656'), metallic=1.0, roughness=0.3),
        'wood': pbr('handle-wood', 'dark_wood', tint=(0.66, 0.5, 0.4)),
        'bone': flat('bone', srgb('#dcd0b4'), roughness=0.42, sss=0.35),
        'glaze': flat('glaze', srgb('#56664a'), roughness=0.16),
        'clay': flat('clay', srgb('#8a5a3a'), roughness=0.8),
        'glass': flat('glass', srgb('#dcefea'), roughness=0.04, alpha=0.28),
        'tincture': flat('tincture', srgb('#2e9a5a'), roughness=0.08, alpha=0.82, emission=srgb('#1a6a3a'), emission_strength=0.4),
        'leech': flat('leech', srgb('#241a14'), roughness=0.22, sss=0.35),
        'gut': flat('gut', srgb('#cfae7c'), roughness=0.55, sss=0.25),
        'ember': flat('ember', srgb('#ff7a2a'), roughness=0.6, emission=srgb('#ff5a10'), emission_strength=7.0, flicker=0.6),
        'lens': flat('lens-glass', srgb('#bcd8f0'), roughness=0.02, alpha=0.32),
        'salve': flat('salve', srgb('#d8e0a8'), roughness=0.3, sss=0.4),
    }


def along_x(o, x=0.0, y=0.0, z=0.0):
    """Lathe/cylinder objects are built along Z: lay them along +X."""
    return transform(o, (x, y, z), (0, math.pi / 2, 0))


def leaf_blade(name, length, width, thick, mat, x0=0.0):
    """A double-edged lancet blade: diamond cross-section, leaf outline, sharp tip."""
    bm = bmesh.new()
    n = 24
    rings = []
    for i in range(n + 1):
        t = i / n
        w = width * math.sin(math.pi * min(1.0, t ** 0.75)) * (1 - t) ** 0.35 if 0 < t < 1 else 0.0
        w = max(w, width * 0.35) if t < 0.08 else w
        h = thick * (w / width) + thick * 0.15 * (1 - t)
        x = x0 + t * length
        rings.append([bm.verts.new((x, w, 0)), bm.verts.new((x, 0, h)), bm.verts.new((x, -w, 0)), bm.verts.new((x, 0, -h))])
    for a, b in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, mat, smooth=False, auto_smooth=None)


def turned_handle(name, length, r, mat, beads=3):
    """A turned handle: swelling grip with beads, profile along Z."""
    prof = [(0.0, 0.0), (r * 0.7, 0.0), (r * 0.95, length * 0.04)]
    for i in range(beads):
        z = length * (0.12 + 0.62 * i / max(1, beads - 1))
        prof += [(r * 0.86, z - length * 0.03), (r * 1.05, z), (r * 0.86, z + length * 0.03)]
    prof += [(r * 1.0, length * 0.86), (r * 0.82, length * 0.97), (r * 0.7, length)]
    prof.sort(key=lambda p: p[1])
    return lathe(name, prof, 28, mat)


def lancet(M):
    handle = along_x(turned_handle('lancet-handle', 0.095, 0.0068, M['wood']), -0.095)
    ferrule = along_x(cylinder('lancet-ferrule', 0.006, 0.009, mat=M['brass'], segs=48), 0.0)
    bolster = along_x(lathe('lancet-bolster', [(0.0, 0), (0.0055, 0), (0.004, 0.006), (0.0022, 0.012)], 60, M['steel']), 0.009)
    blade = leaf_blade('lancet-blade', 0.05, 0.0068, 0.0011, M['steel'], x0=0.019)
    return [handle, ferrule, bolster, blade]


def tongs(M):
    parts = []
    for s in (1, -1):
        arm = tube(f'tongs-arm{s}', [(-0.085, 0.024 * s, 0), (-0.05, 0.012 * s, 0), (-0.012, 0.003 * s, 0), (0.0, 0.0, 0), (0.05, -0.005 * s, 0), (0.1, -0.0022 * s, 0), (0.118, -0.0012 * s, 0)], 0.0024, M['steel'], taper=[1.1, 1.0, 1.1, 1.3, 1.0, 0.75, 0.55])
        loop = tube(f'tongs-loop{s}', [(-0.085 + 0.011 * math.cos(a), 0.024 * s + 0.011 * math.sin(a) * 1.15, 0) for a in [i * 2 * math.pi / 24 for i in range(25)]], 0.0022, M['steel'])
        parts += [arm, loop]
    pivot = cylinder('tongs-pivot', 0.0042, 0.006, loc=(0, 0, -0.003), mat=M['brass'], segs=40)
    return parts + [pivot]


def leech_pipe(M):
    """A brass leech-pipe: turned grip, long tube, flared bell; a banded leech emerging from the bell."""
    grip = along_x(turned_handle('pipe-grip', 0.06, 0.0072, M['wood'], beads=2), -0.11)
    ferrule = along_x(cylinder('pipe-ferrule', 0.0068, 0.008, mat=M['brass'], segs=24), -0.05)
    tube_ = along_x(lathe('pipe', [(0.0, 0.0), (0.0042, 0.0), (0.0042, 0.08), (0.0055, 0.086), (0.0048, 0.09), (0.0075, 0.104), (0.013, 0.114), (0.0145, 0.118), (0.0125, 0.119), (0.0, 0.119)], 64, M['brass']), -0.042)
    ring = along_x(lathe('pipe-ring', [(0.0, 0.0), (0.0058, 0.0), (0.0062, 0.002), (0.0058, 0.004), (0.0, 0.004)], 48, M['brass']), 0.0)
    # The leech: a soft, tapering, banded body arching out of the bell and back toward the tube.
    path = [(0.078 + 0.012 * t + 0.02 * math.sin(t * 2.4), 0.012 * math.sin(t * 3.1) - 0.004 * t, 0.006 * math.sin(t * 2.0) - 0.006 * t) for t in [i / 16 for i in range(17)]]
    taper = [0.55, 0.8, 0.92, 1.0, 1.04, 1.06, 1.06, 1.04, 1.0, 0.95, 0.9, 0.84, 0.78, 0.7, 0.62, 0.55, 0.5]
    body = tube('leech-body', path, 0.0058, M['leech'], segs=32, taper=taper)
    bands = []
    for i in range(2, 15, 2):
        x, y, z = path[i]
        dx, dy, dz = (path[i + 1][k] - path[i - 1][k] for k in range(3))
        ln = math.sqrt(dx * dx + dy * dy + dz * dz) or 1
        r = 0.0058 * taper[i] * 1.06
        pts = []
        ax = (dx / ln, dy / ln, dz / ln)
        # A ring around the body axis at this station.
        up = (0.0, 0.0, 1.0)
        u = (ax[1] * up[2] - ax[2] * up[1], ax[2] * up[0] - ax[0] * up[2], ax[0] * up[1] - ax[1] * up[0])
        ul = math.sqrt(sum(c * c for c in u)) or 1
        u = tuple(c / ul for c in u)
        v = (ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0])
        for k in range(25):
            a = k * 2 * math.pi / 24
            pts.append(tuple(p + r * (math.cos(a) * u[j] + math.sin(a) * v[j]) for j, p in enumerate((x, y, z))))
        bands.append(tube('leech-band', pts, 0.00055, M['leech']))
    sucker = along_x(lathe('leech-sucker', [(0.0, 0.0), (0.0034, 0.0), (0.0042, 0.0016), (0.003, 0.0026), (0.0, 0.002)], 32, M['leech']), path[0][0] - 0.002, path[0][1], path[0][2])
    return [grip, ferrule, tube_, ring, body, *bands, sucker]


def gut_thread(M):
    # A curved needle: three-quarters of a ring, pointed at one end.
    arc = [(0.055 + 0.022 * math.cos(a), 0.018 * math.sin(a) * 1.0, 0.0) for a in [math.pi * (0.1 + 1.25 * i / 20) for i in range(21)]]
    needle = tube('needle', arc, 0.0011, M['steel'], taper=[0.3] + [1.0] * 19 + [1.0])
    spool = lathe('spool', [(0.0, 0), (0.016, 0), (0.016, 0.004), (0.009, 0.006), (0.009, 0.026), (0.016, 0.028), (0.016, 0.032), (0.0, 0.032)], 96, M['wood'])
    transform(spool, (-0.03, 0, -0.016), (0, 0, 0))
    wraps = cylinder('wraps', 0.0125, 0.02, loc=(-0.03, 0, -0.01), mat=M['gut'], segs=64)
    thread = tube('thread', [(-0.018, 0.004, 0.0), (0.0, 0.012, 0.003), (0.02, 0.018, 0.0), (0.035, 0.006, 0.0), (0.043, -0.004, 0.0)], 0.0007, M['gut'])
    return [needle, spool, wraps, thread]


def salve(M):
    pot = lathe('pot', [(0.0, 0.0), (0.024, 0.0), (0.028, 0.004), (0.031, 0.02), (0.029, 0.036), (0.024, 0.041), (0.025, 0.044), (0.0, 0.044)], 120, M['glaze'])
    foot = lathe('pot-foot', [(0.0, -0.002), (0.022, -0.002), (0.024, 0.001), (0.0, 0.001)], 120, M['clay'])
    lid = lathe('lid', [(0.0, 0.044), (0.027, 0.044), (0.026, 0.049), (0.012, 0.054), (0.0, 0.055)], 120, M['brass'])
    knob = lathe('knob', [(0.0, 0.054), (0.005, 0.054), (0.0065, 0.058), (0.004, 0.062), (0.0, 0.063)], 60, M['brass'])
    return [pot, foot, lid, knob]


def syringe(M):
    barrel = along_x(cylinder('barrel', 0.0085, 0.07, mat=M['glass'], segs=64), -0.035)
    liquid = along_x(cylinder('liquid', 0.0072, 0.05, mat=M['tincture'], segs=48), -0.013)
    capf = along_x(lathe('cap-front', [(0.0, 0), (0.0095, 0), (0.0095, 0.006), (0.004, 0.012), (0.0015, 0.016), (0.0, 0.016)], 84, M['brass']), 0.035)
    capb = along_x(cylinder('cap-back', 0.0098, 0.006, mat=M['brass'], segs=56), -0.041)
    flange = transform(box('flange', (0.004, 0.042, 0.004), mat=M['brass'], bevel_w=0.001), (-0.043, 0, 0))
    rod = along_x(cylinder('rod', 0.0022, 0.045, mat=M['brass'], segs=32), -0.086)
    thumb = tube('thumb', [(-0.092 + 0.009 * math.cos(a), 0.009 * math.sin(a), 0) for a in [i * 2 * math.pi / 24 for i in range(25)]], 0.0022, M['brass'])
    needle = along_x(cylinder('needle', 0.0007, 0.045, mat=M['steel'], segs=32, r2=0.0003), 0.051)
    return [barrel, liquid, capf, capb, flange, rod, thumb, needle]


def brand(M):
    handle = along_x(turned_handle('brand-handle', 0.08, 0.0085, M['wood'], beads=2), -0.11)
    ferrule = along_x(cylinder('brand-ferrule', 0.0078, 0.01, mat=M['brass'], segs=48), -0.03)
    rod = along_x(cylinder('brand-rod', 0.0026, 0.075, mat=M['iron'], segs=32), -0.02)
    head = along_x(lathe('brand-head', [(0.0, 0.0), (0.0035, 0.0), (0.011, 0.006), (0.011, 0.012), (0.0, 0.013)], 84, M['iron']), 0.055)
    glow = along_x(cylinder('brand-glow', 0.0106, 0.0022, mat=M['ember'], segs=56), 0.0675)
    return [handle, ferrule, rod, head, glow]


def lens(M):
    rim = tube('lens-rim', [(0.03 + 0.024 * math.cos(a), 0.024 * math.sin(a), 0) for a in [i * 2 * math.pi / 40 for i in range(41)]], 0.0028, M['brass'])
    glass = transform(cylinder('lens-glass', 0.0232, 0.003, mat=M['lens'], segs=80), (0.03, 0, -0.0015))
    neck = along_x(cylinder('lens-neck', 0.0035, 0.012, mat=M['brass'], segs=32), -0.006)
    handle = along_x(turned_handle('lens-handle', 0.07, 0.006, M['wood'], beads=2), -0.076)
    return [rim, glass, neck, handle]


BUILDERS = {'lancet': lancet, 'tongs': tongs, 'leech': leech_pipe, 'thread': gut_thread, 'salve': salve, 'tincture': syringe, 'brand': brand, 'lens': lens}


def main():
    # One GLB per instrument.
    for tool_id, build in BUILDERS.items():
        reset(seed=7)
        M = materials()
        join(build(M), f'tool-{tool_id}')
        export(f'tool-{tool_id}')
        print(f'built tool-{tool_id}')
    # A review render: every instrument laid out on linen, lit by a candle and a cool fill.
    reset(seed=7)
    M = materials()
    cloth = box('cloth', (0.62, 0.36, 0.004), loc=(0.0, 0.0, -0.014), mat=pbr('cloth', 'rough_linen', tint=(0.72, 0.62, 0.5)))
    from common import box_uv
    box_uv(cloth, 0.25)
    for i, (tool_id, build) in enumerate(BUILDERS.items()):
        o = join(build(M), tool_id)
        o.location = (-0.2 + (i % 4) * 0.14, 0.09 - (i // 4) * 0.17, 0)
        o.rotation_euler = (0, 0, math.radians(70))
        if tool_id == 'salve':
            o.location.z = -0.012
    preview('tools', (0.0, -0.5, 0.62), (0.0, -0.02, 0.0), lens=42, lights=[
        {'type': 'SPOT', 'loc': (0.35, -0.25, 0.7), 'target': (0, 0, 0), 'energy': 22, 'color': (1.0, 0.72, 0.45), 'spot': math.radians(60), 'soft': 0.04},
        {'type': 'AREA', 'loc': (-0.5, 0.3, 0.5), 'energy': 2.5, 'color': (0.5, 0.6, 0.9), 'size': 0.8},
    ])
    print('built tools preview')


main()
finish()
