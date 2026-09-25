# Audio licences

Every shipped audio file records its licence and provenance in its source sidecar
(`assets-src/audio/<category>/<bank>/<name>.json`: `{"licence": "...", "source": "..."}`),
which the build copies into `public/audio/manifest.json`. `npm run audio:release-check`
fails on any file without both, or marked temporary.

The build currently ships **no recorded audio**: every sound and all music are synthesised at
runtime by original code in `src/audio/` (no samples, no third-party libraries of sounds).

## Libraries and agreements

| Library / agreement | Vendor | Licence | Scope (game, trailers, soundtrack) | Purchased by | Date | Invoice / file |
|---|---|---|---|---|---|---|
| Bells | | | | | | |
| Choir | | | | | | |
| Ambience | | | | | | |
| Foley session (work for hire) | | | | | | |
| Composer | | | | | | |
| VO performers | | | | | | |

## Third-party code

| Package | Use | Licence |
|---|---|---|
| node-web-audio-api (dev only) | offline audio tests | BSD-3-Clause |
| ffmpeg-static (dev only) | asset encoding and loudness measurement at build time; not shipped | GPL-3.0 binary, used as a build tool only |
