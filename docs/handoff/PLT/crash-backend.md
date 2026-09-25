# Crash reporting backend — decision and setup (PLT-0123, PLT-0124, PLT-0130)

## Recommendation: Sentry (decision to be confirmed by the project owner)

| | Sentry | BugSplat | Backtrace |
|---|---|---|---|
| Electron/Crashpad minidumps | yes (`/api/<project>/minidump/`) | yes | yes |
| JS errors + source maps from the same project | yes (envelope endpoint, already implemented in `src/platform/crash.ts`) | separate SDK | yes |
| Symbol upload from CI | `sentry-cli debug-files upload` (already in `build.yml`) | `symbol-upload` | `backtrace` CLI |
| Crash-free sessions metric | yes (release health) | no | partial |
| Cost at demo scale | Team plan | per-crash pricing | enterprise |

The code is backend-agnostic for native crashes (Crashpad `submitURL`) and speaks Sentry's envelope protocol for JS
errors; choosing BugSplat/Backtrace means swapping `sentryEnvelope()` for their JSON endpoint.

## Steps (Sentry)

1. Create organisation + project `suture-and-steel` (platform *Electron*); data region EU.
2. Project settings → Client Keys → copy the **DSN** → GitHub secret `VITE_SENTRY_DSN`.
3. Security & Privacy → enable *Data scrubbing* + *Scrub IP addresses*; retention 90 days.
4. Minidump endpoint: Settings → Client Keys → *Minidump Endpoint* URL → secret `SS_CRASH_SUBMIT_URL`.
5. Auth token with `project:releases` + `project:write` → secrets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
6. Run *build*: source maps (`dist/*.map`, uploaded with url prefix `app://game/`) and native symbols (PDB/dSYM/
   Linux debug files) upload per release `suture-and-steel-<edition>@<build id>`. The package check guarantees no map
   is shipped.
7. Test on a QA build with crash reports set to *On* (first-run prompt or `settings.json` → `"crashReports":"on"`):
   - JS error: launch with `--dev`, open devtools (Ctrl+Shift+I), run `setTimeout(() => { throw new Error('sentry test') })`
     → event in Sentry within a minute, stack symbolicated against the uploaded source maps.
   - Native crash: in devtools run `while (true) {}` → after 10 s the "not responding" dialog appears → *Restart*
     deliberately crashes the renderer (`forcefullyCrashRenderer`) so Crashpad writes a minidump → it arrives in Sentry
     with the release set, and the game reloads at the last autosave.
8. Dashboard (PLT-0130): Sentry → Releases → *Crash Free Sessions* for the demo release on the `beta` branch; add an
   alert: crash-free sessions < 99.5 % over 24 h → e-mail + team channel. Demo launch gate: ≥99.5 % on `beta` before
   promotion (`docs/release.md`).

Artifacts retention (PLT-0150): GitHub keeps build artifacts 90 days (maximum). For ≥2 years, add a
`release-archive` job that copies the tagged builds' tar.gz + `.sha256` to a storage bucket (S3/B2 with object lock,
lifecycle 3 years); Sentry keeps symbols as long as the project exists.
