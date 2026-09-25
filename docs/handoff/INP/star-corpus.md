# Star corpus capture (INP-0055)

Goal: ≥ 300 positive star strokes and ≥ 300 negative strokes, from ≥ 15 people, covering mouse,
trackpad, pen (as mouse) and gamepad stick (virtual cursor, hold LT and trace).

## Session setup
1. Use a QA build (`npm run build` without `--mode release`) and open the game with `?record=1`.
2. Start any Chapter 1 operation that has the Litany (op1-3 or later). Leave the time assist on
   Relaxed so the session is not cut short.
3. Each tester draws strokes with the Litany button held (right mouse, or LT on a pad). The
   Litany only casts once per operation, which does not matter: every stroke is recorded.
4. Record **positives and negatives in separate operations** (restart between them), so every
   stroke in a recording has the same label.
5. When the operation ends or is abandoned the browser downloads `input-<op>-<time>.json`.

## What to ask for
- Positives: five-pointed stars at the tester's natural size and speed; then 5 quick hurried ones;
  5 started from a different point; 5 drawn in the other direction; 5 small ones.
- Negatives: circles, check marks, scribbles, zig-zags, the motion they use for stitching,
  triangles, squares, figure-eights; also a few half-finished stars they abandon.

## Converting
```
node scripts/extract-stars.mjs star mouse tests/fixtures/stars/<tester>-mouse-pos.json input-*.json
node scripts/extract-stars.mjs other mouse tests/fixtures/stars/<tester>-mouse-neg.json input-*.json
```
Device is one of `mouse`, `trackpad`, `pen`, `gamepad` (the gamepad profile is used for those).
Every `tests/fixtures/stars/*.json` file is benchmarked by `tests/starBenchmark.test.ts`
(CI fails below 95 % true-positive / above 1 % false-positive rate).

## Consent
Strokes are anonymous point lists; the file name should carry a tester number, not a name.
