# Secret scanning (QAT-0008)

**What runs:** gitleaks (pinned version in `.github/workflows/qa-secrets.yml`) on every push and pull request,
scanning the commits in that push/PR with `.gitleaks.toml`: gitleaks' default rules plus project rules for

| Rule id | Catches |
|---|---|
| `steamworks-builder-password` | SteamPipe build account passwords in scripts, env files, CI config |
| `steamworks-config-vdf` | Steam client auth caches (`config.vdf`, `ssfn*`) that let anyone upload builds |
| `steam-web-api-key` | Steam Web API publisher keys |
| `sentry-auth-token`, `sentry-dsn-with-secret` | Crash-reporter auth tokens and secret-bearing DSNs |
| `telemetry-ingest-token` | Telemetry ingest / kill-switch admin tokens |
| `discord-webhook` | Discord webhooks (the QA and team notification channels) |
| `code-signing-material` | `.pfx/.p12/.p8/.cer/.mobileprovision/.keystore/.jks` files |
| `signing-password` | Authenticode / notarization / Apple ID app-specific passwords |

A finding fails the check and blocks the merge. **If a real secret was pushed:** revoke/rotate it first (Steam
partner site, Sentry, telemetry backend, Discord, certificate authority), then remove it from history — rotating
is what protects us; rewriting history alone does not.

**Where secrets live instead:** GitHub Actions secrets (`STEAM_*`, `QA_DISCORD_WEBHOOK`, `TEAM_WEBHOOK_URL`,
signing secrets) and the producer's password manager. Nothing secret is ever needed to build or test the game locally.

## Allow-list review

`[allowlist]` in `.gitleaks.toml` may only hold entries with a reason and the milestone they were last reviewed.
At every milestone gate (Demo RC, Alpha, Beta, Release) QA:

1. re-reads every allow-list entry and deletes the ones no longer needed;
2. runs a full-history scan: `gitleaks git --config .gitleaks.toml --redact .` and files any finding as S1 (`area:legal`);
3. updates the "Reviewed:" milestone on each remaining entry in the same PR.

| Milestone | Reviewed by | Date | Result |
|---|---|---|---|
| Demo (initial rules) | QA | 2026-09-25 | 3 path entries (lockfile, build output, rule docs); full working-tree scan clean |
