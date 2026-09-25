# Foley session plan (AUD-0030)

**Format:** 48 kHz / 24-bit WAV, mono close mic (small-diaphragm condenser, 20–30 cm) plus a
stereo room pair for the "room" takes; ≥ 5 takes per action, varied force and speed.
Deliver into `assets-src/audio/sfx/<bank>/<event-id>.<nn>.wav` with a `.json` sidecar
(`{"licence":"work for hire","source":"foley 2026-xx-xx, take n"}`), then `npm run audio:build`.

## Props

Savoy cabbage, celery, wet chamois, raw pork belly and chicken thighs, gelatine blocks, soaked
leather offcuts; antique or reproduction steel instruments (scalpel, forceps, bone saw, probe),
enamel/brass kidney dish; glass vials and apothecary jars with cork and ceramic lids; wax and a
brass seal; parchment and a quill; waxed linen thread and a curved needle through leather;
a cautery iron (or a heated steel bar) and a water bucket for quench; wooden arrow shafts, a
crossbow bolt, lead shot, a tooth (resin cast), glass shards, a quartz crystal (hexstone).

## Shot list (maps to event ids in `docs/audio/sfx-events.csv`)

| Group | Actions | Event ids |
|---|---|---|
| Lancet | touch, slow/fast cut through chamois-on-pork, slip across steel, air swipe, nick | `sfx.lancet.*`, `loop.lancet.cut` |
| Tongs | open/close, grab flesh/hard, strain (pull cabbage leaf), pull out each object, drop in dish | `sfx.tongs.*`, `sfx.extract.*`, `loop.tongs.strain` |
| Leech-pipe | suction through a straw into water / jelly / thick soup | `loop.leech.suck`, `sfx.leech.slurp` |
| Gut thread | needle pierce leather, thread zip, knot | `sfx.thread.*` |
| Salve | jar lid, finger smear on gelatine | `sfx.salve.*`, `loop.salve.smear` |
| Tincture | vial clink, plunger (syringe in water) | `sfx.tincture.*`, `loop.tincture.plunge` |
| Cautery | hot iron on pork (sizzle), on wet cloth, quench | `loop.brand.*`, `sfx.brand.quench` |
| Wounds | tearing cabbage/celery (barbed tear), bubo lance (grape in gelatine), pus burst | `sfx.barb.tear`, `sfx.bubo.*` |
| UI | quill scratch, wax stamp, page turns, latch, cloth rustle | `ui.*` |

## Slate log template

| File | Event id | Take | Prop | Mic | Notes |
|---|---|---|---|---|---|
| | | | | | |
