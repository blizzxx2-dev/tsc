# Audio & focus suite (QAT-0137)

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-AUD-001 | Bus volumes in play | P1 | full | 4 | In op1-4, each bus slider changes its sounds only (stitch, squelch, burn = SFX; ambience/music; VO) | |
| TC-AUD-002 | Mute when unfocused | P1 | full | 3 | With "mute in background" on, alt-tab → silence within 0.5 s; return → sound resumes, no burst of queued cues | |
| TC-AUD-003 | Headphone unplug mid-op | P1 | full | 4 | Unplug/replug headphones (and switch default device) during op1-5 → audio moves to the new device or recovers without restart; the op continues | |
| TC-AUD-004 | Steam overlay during an op | P0 | regression | 3 | Shift+Tab mid-op (and mid-drag) → the op pauses (or input releases); closing the overlay resumes without a stuck button or penalty | |
| TC-AUD-005 | Minimise / restore | P1 | full | 3 | Minimise during the Lauds fight for 2 minutes → on restore the op is paused, audio consistent, frame pacing normal | |
