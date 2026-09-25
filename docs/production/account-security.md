# Account security (OPS-0013)

Owner: Owner. Every critical account has **2FA**, **two admins** (so no single person can lock the
studio out) and its credentials only in the team password manager. Recovery codes live in the password
manager's owner-only vault plus a sealed paper copy off-site.

| Account | 2FA method | Admin 1 | Admin 2 | Recovery codes stored | Checked |
|---|---|---|---|---|---|
| GitHub organisation (require 2FA for all members) | TOTP or security key | Owner | Producer | | |
| Steamworks partner account (two users with *Admin*; others least-privilege) | Steam Guard mobile | Owner | Producer | | |
| Domain registrar (registrar lock on, auto-renew on) | TOTP / security key | Owner | Producer | | |
| DNS provider | TOTP | Owner | Producer | | |
| Company email (admin console) | security key | Owner | Producer | | |
| Password manager (business plan, shared vaults) | security key | Owner | Producer | n/a | |
| Discord (server owner + admin role; *Require 2FA for moderation* on) | TOTP | Owner | Marketing lead | | |
| X, Bluesky, YouTube, TikTok, Reddit | TOTP | Marketing lead | Owner | | |
| Newsletter provider | TOTP | Marketing lead | Owner | | |
| TMS (Crowdin/Lokalise) | TOTP | Loc lead | Owner | | |
| Crash-reporting / telemetry processors | TOTP | Owner | Producer | | |
| Bank / payment processor | bank's method | Owner | (second signatory) | | |

## Rules
- No shared personal logins. Service accounts use a role mailbox (e.g. `steam@`, `social@`).
- Shared credentials only as password-manager items; never in chat, email or the repository.
- Offboarding the same day a contract ends: remove from every row above, rotate any shared item they used.
- Quarterly check: the producer ticks the *Checked* column and notes the date in the status note.
