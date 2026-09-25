# AUD — tasks that need a human

The software side of each task below is done or prepared; a person must record, approve,
sign, measure on hardware or playtest. Material referenced lives in this folder and in `docs/audio/`.

- AUD-0024 — Run the device-resilience manual matrix (headphone unplug, default-device change, sample-rate change, macOS interrupted context) on Windows/macOS/Linux/Steam Deck; recovery code is in `src/audio/engine.ts` (`recover`, `bindEnvironment`). Checklist: `device-matrix.md`
- AUD-0025 — Measure output latency in the Electron build on Windows WASAPI (target < 40 ms) with the F4 overlay's latency readout; procedure in `hardware-measurements.md`
- AUD-0029 — Owner approves the SFX direction brief `docs/audio/sfx-direction.md` (sign-off table at the end)
- AUD-0030 — Book and run the foley session; plan, shot list and slate log template in `foley-session.md`
- AUD-0031 — Buy/record licences for bell, choir and ambience libraries and fill `docs/licences/audio.md`; per-file provenance goes in each source's `.json` sidecar (enforced by `npm run audio:release-check`)
- AUD-0068 — Owner approves the music direction brief `docs/audio/music-direction.md`
- AUD-0069 — Contract a composer for ≈ 30 min of stemmed demo music; brief, deliverables and rights checklist in `composer.md` (cue list: `docs/audio/music-cues.md`)
- AUD-0095 — Owner decides the demo VO scope; draft decision with line counts and cost estimate in `vo-plan.md`
- AUD-0100 — Cast Ilse, Kreuzer, Stroh, Haller, Mauer and the Hollow Choir (human performers only); casting briefs and audition sides in `vo-plan.md`
- AUD-0101 — Sign performer contracts; clause checklist in `vo-plan.md`
- AUD-0102 — Record Sister Ilse's barks (script `docs/audio/vo-script.csv`, context and emotion columns); session plan in `vo-plan.md`
- AUD-0103 — Record grunt-style VN vocalisations per character and emotion; list in `vo-plan.md`
- AUD-0104 — Record Kreuzer's efforts (pulls, "Be still" Litany whisper, exhale, shaken breath); list in `vo-plan.md`
- AUD-0105 — Record and process the Matins and Lauds Malison voices with the chain in `docs/audio/malison-voices.md`
- AUD-0106 — Master delivered VO to −24 LUFS ±1 / ≤ −3 dBTP; the batch check is `npm run audio:check` (VO category)
- AUD-0109 — Mix passes on studio monitors, laptop speakers, Steam Deck speakers and headphones; checklist and issue log in `mix-passes.md`
- AUD-0117 — A deaf or hard-of-hearing tester completes Ch1–2 with sound off; audit table `docs/audio/parity-audit.md`, session script in `parity-playtest.md`; file UIX tasks A–C listed in the audit
- AUD-0120 — Composer delivers the Prime and Terce boss themes (procedural sketches `prime`, `terce` in `src/audio/music/themes.ts` define sections and tempo); see `composer.md`
- AUD-0121 — Composer delivers the Sext and None boss themes; see `composer.md`
- AUD-0122 — Composer delivers the Vespers and Compline boss themes; see `composer.md`
- AUD-0135 — Owner decides full-game VO scope from demo wishlist conversion and budget; worksheet in `vo-plan.md`
- AUD-0136 — Record Chapter 3–5 VO and pickups for changed Ch1–2 lines (`npm run vo:export` prints pickups); see `vo-plan.md`
- AUD-0137 — Record the remaining Malison voices (Prime–Compline) with the documented chain; ids `sfx.hour.<hour>.<kind>` already exist with procedural placeholders
- AUD-0138 — Portrait lip-flap needs mouth-frame art per voiced character; the VO pipeline can add a 50 Hz amplitude envelope to the manifest once frames exist (see `vo-plan.md`)
- AUD-0141 — Final full-campaign mix and loudness sign-off in `docs/audio/loudness.md` (table at the end); procedure in `mix-passes.md`
- AUD-0142 — Measure the audio thread on Steam Deck during a 30-minute soak of the busiest boss replay (target ≤ 3 % CPU, 0 underruns); procedure and desktop baseline in `hardware-measurements.md`
- AUD-0145 — Master and release the soundtrack album as Steam DLC with liner notes; checklist in `composer.md`
- AUD-0146 — If DACH sales exceed the plan threshold, record German VO into the per-language folder (`assets-src/audio/vo/de/…`; no code change needed); see `vo-plan.md`
- AUD-0147 — Post-launch audio bug triage with before/after loudness captures (`npm run audio:capture`); process in `mix-passes.md`
