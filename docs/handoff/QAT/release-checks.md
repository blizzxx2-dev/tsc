# Release-time checks that need people, machines or accounts

## Compatibility lab sweep (QAT-0112)

Contract a compatibility lab (or the tester pool with matching hardware) to run on **≥ 15 configurations** — NVIDIA
GTX 900 → RTX 40, AMD Polaris → RDNA3, Intel UHD / Iris Xe / Arc, and hybrid-graphics laptops — the demo smoke
subset (`docs/qa/patch-regression.md` rows 1, 3, 4, 5, 7) plus one boss (Matins or Lauds) under
`docs/qa/perf-protocol.md`. Brief for the lab: build id, the checklist, expected evidence (screenshots, PresentMon
log, dxdiag/`vulkaninfo`), 48 h turnaround. Merge every result into `docs/qa/compat-matrix.md` with its evidence link.

## Antivirus false positives (QAT-0114)

For every RC executable/installer:
1. Upload to VirusTotal (web UI, or `curl -F file=@<exe> -H "x-apikey: $VT_API_KEY" https://www.virustotal.com/api/v3/files`)
   and record the report link in the sign-off.
2. Any detection: submit the file as a false positive to that vendor (Microsoft: https://www.microsoft.com/wdsi/filesubmission,
   others via their FP forms), including the signed binary and the store page; re-scan after the vendor updates.
3. No release with an open detection from Microsoft Defender, and not more than one from the rest.

## Desktop security verification (QAT-0115)

On the packaged demo (PLT's Electron build): run `npx @doyensec/electronegativity -i <app source dir> -o report.sarif`
and resolve every HIGH finding; then confirm by hand on the installed build:

| Check | How |
|---|---|
| `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on every BrowserWindow | read `desktop/` main process; `process` is undefined in the devtools console of a dev build |
| CSP set (no `unsafe-eval`, scripts only from `app://`) | response headers / meta in the packaged `index.html` |
| DevTools cannot be opened in release (no menu, shortcut disabled) | Ctrl+Shift+I / F12 do nothing |
| No remote content loaded except the store URL via `shell.openExternal` | network log |
| Fuses: RunAsNode off, NodeOptions off, ASAR integrity on | `npx @electron/fuses read --app <exe>` |

## Idle soak (QAT-0144)

On the reference PCs and a Deck, run 8 hours each on the title, a paused op2-5 and the demo-end screen. Browser
driver for the web build: `node scripts/qa/soak.mjs <title|paused-op|demo-end> 8` (fails on errors, stalls or heap
growth > 50 MB). For the packaged build, park the game on the scene and log process memory every minute
(`typeperf "\Process(<exe>)\Working Set - Private" -si 60` on Windows; `pidstat -r 60` on SteamOS); pass = no crash,
< 50 MB growth, audio still playing.

## RC sign-off (QAT-0147) and 1.0 RC regression (QAT-0166)

On the RC commit, after the manual suites: `GITHUB_TOKEN=… GITHUB_REPOSITORY=… node scripts/qa/signoff.mjs demo-rc`
writes `docs/qa/signoff/demo-rc.md` with the SHA, automated results, open S1–S3 and cert progress; the QA lead fills
the manual rows and the producer, QA lead and tech lead sign it before the build is set live. The same with
`1.0-rc` for release, after the full test plan on every matrix OS.

## Next Fest QA rota (QAT-0149)

During the festival week, one QA person per day (rota in the team calendar): 09:00 and 17:00 crash-report and forum
sweep (Steam discussions, Discord #bug-reports), new bugs filed with `community`; every hotfix verified with the
60-minute checklist (`docs/qa/patch-regression.md`) inside PLT's 4-hour pipeline; daily note in the production channel.

## Community intake, known issues, crash review (QAT-0091, 0093, 0150, 0170)

- Weekly community sweep and replies as in `docs/qa/bug-process.md` § 8.
- For each public build: `node scripts/qa/known-issues.mjs <build-id>` and pin the list on Steam and Discord.
- Before the Alpha gate: review every community-reported demo bug — fixed, or deferred with a written reason (0150).
- Post-launch: every two weeks for three months, review the top 10 crash signatures; each gets a fix or a
  known-issues entry (0170).
