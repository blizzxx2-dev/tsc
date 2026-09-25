# Voice-over plan (AUD-0095, 0100–0104, 0106, 0135–0138, 0146)

## Scope decision draft (AUD-0095, owner decides)

**Recommendation:** the demo ships fully voiced Sister Ilse operation barks (gameplay-critical) and
grunt-style emotive snippets for VN lines (all speaking characters). Full VN VO is decided at
Alpha by budget (AUD-0135).

Line counts from `npm run vo:export` (`docs/audio/vo-script.csv`): 141 lines today — 71 story
lines (not voiced under the recommendation), 46 phase callouts, 24 in-operation barks; barks marked
`variants = 3` need three takes.

| Item | Count | Est. studio time | Est. cost (non-union, EUR) |
|---|---|---|---|
| Ilse barks + callouts (×3 takes, ~150 lines incl. variants) | ≈ 150 | 1 session (4 h) | 900–1 500 |
| Grunt-style VN sets: 6 characters × 6 emotions × 3–6 | ≈ 150 | 6 × 1 h | 1 800–3 000 |
| Kreuzer efforts + Litany whisper | ≈ 20 | (in his grunt session) | — |
| Hollow Choir / Malison voices (ensemble) | 2 hours | 1 session | 1 500–2 500 |
| Editing, naming, mastering | — | 3 days | 900–1 500 |
| **Total** | | | **≈ 5 100–8 500** |

## Runtime (already implemented)

- Line ids: runtime asset key `vo/<line id>` where the id is a hash of the text (`lineId` in
  `src/audio/vo.ts`); the export also gives a readable content id (`s1-2.014`, `op1-2.p0.1`, `bark.flooded`).
- Takes: `vo/<id>`, `vo/<id>.2`, `vo/<id>.3` — chosen without immediate repeats, with a 20 s per-bark cooldown.
- Language folders: `vo/<lang>/<id>` wins over `vo/<id>` — German VO (AUD-0146) needs no code change.
- Subtitles (on by default, S–XL, background opacity) timed to the recording; long translations split into cards.
- Barks duck music −8 dB and ambience −6 dB; an urgent line cuts a tip with a 60 ms fade; the callout panel stays up while the voice plays.

## Casting briefs (AUD-0100)

| Role | Voice | Audition side |
|---|---|---|
| Sister Ilse | warm, steady alto; calm under pressure; mercy, not softness | "Vitals are failing! Use the tincture, Doctor!" / "There. It's surfacing — finish it." |
| Dr. Kreuzer | weary baritone; efforts, whispered prayer | "Be still…" (whisper), a strained pull, a relieved exhale |
| Inquisitor Stroh | cold, precise bass-baritone | two lines from Chapter 2 story scenes |
| Master Haller | gravelly elder, dry humour | "Letters don't stop a man bleeding into the straw. Hands do." |
| Captain Mauer | gruff soldier | a Chapter 2 briefing line |
| Hollow Choir | whispered ensemble (4–8) | the Matins office in Latin, whispered and sung |

Three auditions per role; human performers only — no synthetic voices.

## Contract clauses (AUD-0101)

Usage: demo, full game, trailers, store pages, social clips; credit name; pickup rate; union status;
no AI training/cloning of the performance; approval of any re-use outside the game.

## Session plans

- **Ilse barks (AUD-0102):** record in script order by operation; three takes per line (read the `emotion` and
  `context` columns); 48 kHz / 24-bit; name files `<asset_key>.wav`, `<asset_key>.2.wav`, `<asset_key>.3.wav`
  in `assets-src/audio/vo/vo-ops/`.
- **Grunt-style VN sets (AUD-0103):** per character 3–6 vocalisations per emotion (neutral, surprised, angry,
  sad, amused, pained) → `assets-src/audio/vo/vo-story/<character>.<emotion>.<n>.wav`; the story director will
  pick one at line start once an `emotion` tag is added to story lines (narrative content).
- **Kreuzer efforts (AUD-0104):** long-pull strain ×5, "Be still" whisper ×5, relieved exhale ×5, shaken breath ×5.
- **Mastering (AUD-0106):** −24 LUFS ±1 integrated, ≤ −3 dBTP, matched room tone; `npm run audio:check` verifies.

## Lip-flap (AUD-0138)

Needs mouth frames per voiced character (art). Audio side: add a 50 Hz RMS envelope per VO file to the
manifest in `scripts/audio-build.mjs` when the frames exist.
