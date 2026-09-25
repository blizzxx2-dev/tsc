# Cross-file dependency map (OPS-0011)

Owner: Producer. The full, regenerable list of every task that names another workstream is
[dependencies-generated.md](dependencies-generated.md) (`node scripts/ops/deps.mjs --write`, 143
dependencies). This page records the **phase conflicts** found in it — a task needs another
workstream's work earlier than that workstream has phased it — and their resolution.

Re-tagging a task's phase is done by the task's owner in their roadmap file; until they do, the
conflict stays **open** here and is listed in the handoff (`docs/handoff/OPS/README.md`, OPS-0011).

## Phase conflicts

| # | Needs (task, phase) | Depends on (task, phase) | Both owners | Resolution | State |
|---|---|---|---|---|---|
| C-1 | LOC-0006…0033, LOC-0056…0065 (Demo): the demo ships localised | PLT-0172 *Localisation string tables* (**Alpha**) | LOC ↔ PLT | Re-tag PLT-0172 to Demo. The runtime is already implemented in `src/i18n` (string tables, missing-key detection, pseudo-localisation), so PLT-0172's remaining work is loading tables "as content" through the PLT pipeline | open — PLT to re-tag |
| C-2 | LOC-0029…0033 (Demo) pseudo-loc and width budgets | UIX-0200 *Pseudo-localisation build* (**Beta**) | LOC ↔ UIX | Re-tag UIX-0200 to Demo. `?lang=qps` / `qps-long` / `qps-cjk` already work in any build; UIX-0200 becomes the screen-by-screen overflow review | open — UIX to re-tag |
| C-3 | LOC-0053 (Demo) pause-menu language switch for LQA | UIX-0203 *Language switch at runtime* (**Beta**) | LOC ↔ UIX | Re-tag UIX-0203 to Demo. Options → Language exists (`src/scenes/options.ts`); UIX-0203 adds font/caption reload and the UIX-0104 Language tab | open — UIX to re-tag |
| C-4 | LOC-0011 (Demo) simulation stores keys for rating labels | GAM entity code (`src/surgery/*`, GAM-owned) — no GAM task exists | LOC ↔ GAM | Add a GAM Demo task "rate()/popup()/lose() take string keys"; until then the HUD resolves English source text through `tSource()` (D-0006) | open — GAM to add task |
| C-5 | LOC-0014 (Demo) `OperationDef.patientGender` for all ten demo ops | NAR/CON op schema (CON) | LOC ↔ CON | CON adds `patientGender` to the op schema in its Demo op-schema task | open — CON |
| C-6 | LOC-0018 (Demo) per-locale reading time in `Operation.update` | GAM/ENG ownership of `src/surgery/operation.ts` | LOC ↔ GAM | Reading factor is in `src/i18n/locales.ts` (`reading`); GAM applies it in the callout timer when the sim moves to keys (C-4) | open — GAM |
| C-7 | LOC-0025 (Demo) fallback-glyph highlighter | ENG glyph atlas (`src/render/text.ts`) | LOC ↔ ENG | ENG adds a dev flag that tints glyphs not in the locale's bundled faces (`src/i18n/fonts.ts` gives the face list) | open — ENG |
| C-8 | LOC-0022/0023 glyph lists for baking (Demo) | ENG font subsetting / MSDF build (Demo) | LOC ↔ ENG | No phase conflict; hand-off artefact is `loc/glyphs/<locale>.txt` (`npm run i18n:glyphs -- --emit`) | agreed |
| C-9 | OPS-0063 AI disclosure (Demo) | ART and AUD provenance logs (ART/AUD Demo) | OPS ↔ ART, AUD | Same phase; the survey is answered from the logs at every gate | agreed |
| C-10 | OPS-0076 rich-presence in every demo language (LOC-0076, Demo) | PLT-0045 rich-presence tokens (Demo) | LOC ↔ PLT | Same phase; LOC translates the PLT token file once it exists | agreed |
| C-11 | OPS-0054 hexstone decision (Demo) | GAM and NAR task wording (`warpshard`/`hexshard`) | OPS ↔ GAM, NAR | D-0007 chose `hexstone`; GAM/NAR owners update their task text | open — GAM, NAR |
| C-12 | OPS-0028 Ch3–5 scope (≈ 5 ops/chapter) | NAR outline lists 28 Ch3–5 operations | OPS ↔ NAR | Proposal in [scope-ch3-5.md](scope-ch3-5.md): 21 at 1.0, 7 deferred to post-launch | open — lock 1 Mar 2027 |
