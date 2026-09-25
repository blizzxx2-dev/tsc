# Languages: scope, matrix and decisions (LOC-0001 … LOC-0005)

## Demo language subset (LOC-0001, decision D-0003)
| Set | Languages | When |
|---|---|---|
| **Core (demo)** | English (source) + German `de`, French `fr`, Spanish (Spain) `es-ES`, Polish `pl`, Brazilian Portuguese `pt-BR` | Translation from the 11 Dec 2026 string freeze |
| **Stretch (demo)** | Russian `ru`, Simplified Chinese `zh-Hans` | **Go/no-go at demo feature lock, 11 Dec 2026** — go only if the ENG Cyrillic/CJK font pages are built and `npm run i18n:glyphs` passes for a pseudo run of each script |
| **Beta** | Italian `it`, Japanese `ja`, Korean `ko` (+ any stretch language not taken) | Full-game loc handoff 30 Jul 2027 |
Every language is registered in `src/i18n/locales.ts`; it becomes visible to players only when signed
off (D-0015).

## Spanish variant (LOC-0003, decision D-0004)
Spain (`es-ES`) first; re-check Steam traffic by country on 15 Jan 2027; Latin-American Spanish is a
Post option (LOC-0108).

## Supported-languages matrix (LOC-0004)
Mirror **exactly** in Steamworks for the demo app and the full-game app (Steamworks → Store Page Admin
→ Supported Languages; handoff LOC-0004). A language is ticked only after its sign-off.
| Language | Interface | Subtitles | Full Audio | Demo | 1.0 |
|---|:---:|:---:|:---:|:---:|:---:|
| English | ✔ | ✔ | ✔ | ✔ | ✔ |
| German | ✔ | ✔ | — | ✔ | ✔ |
| French | ✔ | ✔ | — | ✔ | ✔ |
| Spanish – Spain | ✔ | ✔ | — | ✔ | ✔ |
| Polish | ✔ | ✔ | — | ✔ | ✔ |
| Portuguese – Brazil | ✔ | ✔ | — | ✔ | ✔ |
| Russian | ✔ | ✔ | — | stretch | ✔ |
| Simplified Chinese | ✔ | ✔ | — | stretch | ✔ |
| Italian | ✔ | ✔ | — | — | ✔ |
| Japanese | ✔ | ✔ | — | — | ✔ |
| Korean | ✔ | ✔ | — | — | ✔ |
Full Audio is English only (AUD VO plan). "Subtitles" covers story text and callout/bark captions.

## Right-to-left scripts (LOC-0005, decision D-0005)
Arabic and Hebrew are **not planned for 1.0**; layout and text code need no bidirectional support.
Revisited in the post-launch language review (LOC-0108).

## Re-phasing of sibling tasks (LOC-0002)
The demo ships localised, so these sibling tasks are needed at **Demo**, not later (details and owners
in `docs/production/dependencies.md`, conflicts C-1…C-3): PLT-0172 string tables (Alpha → Demo),
UIX-0200 pseudo-localisation build (Beta → Demo), UIX-0203 runtime language switch (Beta → Demo), plus
the UIX string-extraction work. The runtime pieces already exist in `src/i18n`; the owners re-tag their
tasks and sign off on the board (handoff LOC-0002).
