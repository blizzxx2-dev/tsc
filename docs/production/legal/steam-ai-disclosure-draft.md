# Steam AI-generated content disclosure — DRAFT ANSWERS (OPS-0063)

Steamworks → App Admin → Content Survey → AI Generated Content. Answered for both the demo and
full-game apps from the ART and AUD provenance logs; **re-checked at every milestone gate** (the gate
checklist in [../gates.md](../gates.md) includes it). Submitting the survey is a human step (handoff OPS-0063).

## Evidence at 2026-09-25
| Content | How it is made today | Source |
|---|---|---|
| Rendering, flesh, backdrops, portraits (current build) | **Procedural** — GLSL shaders and code-drawn shapes in `src/render/*`, `src/scenes/backdrop.ts` | repository |
| Fonts | OFL fonts (IM Fell English, UnifrakturMaguntia) | `@fontsource` packages |
| Audio | Procedural WebAudio cues (`src/core/audio.ts`) | repository |
| Text (story, UI) | Written for the project; the code and some text have been produced with AI coding assistance under human direction and review | commit history, NAR process |
| Final art/music/VO | Not yet commissioned — contractors must disclose AI use per the contractor agreement (AI clause) | provenance logs to come |

## Draft answers
**Pre-generated AI content** (content created with AI tools during development):
> *Draft:* "Parts of the game's code and some draft text were produced with the help of AI assistants
> and were reviewed, edited and integrated by the development team. All art, music and voice in the
> released game are made by human artists [update if any provenance log records otherwise]. The game
> contains no AI-generated images, audio or voices." — *to be confirmed against the ART/AUD provenance
> logs at the demo gate; counsel/Owner decide the final wording.*

**Live-generated AI content** (content generated while the game runs): **None.** The game does not
call any AI model at runtime. (Procedural shaders/randomness are not AI generation.)

**Guardrails statement** (only needed for live generation): not applicable.
