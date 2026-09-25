# Records of processing and DPAs (OPS-0069)

**Draft — to be completed and kept current by the Owner; counsel reviews.** The signed DPAs and this
record live in `docs/legal/` (private). Art. 30 GDPR record of processing activities:

| # | Processing activity | Purpose | Data subjects | Data categories | Recipients / processors | Transfer safeguard | Retention | Security measures | DPA signed |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Gameplay telemetry (opt-in) | Balance, stuck-point and performance analysis | Players who opt in | Random install ID, version, OS/hardware class, settings, gameplay events | [Telemetry provider] | [EU region / SCCs] | Raw 90 days; aggregates indefinitely | TLS in transit, provider encryption at rest, access limited to 2 named staff | ☐ |
| 2 | Crash reporting (opt-in) | Fix crashes | Players who opt in | Install ID, stack trace, OS/GPU/driver, last 200 log lines | [Crash provider] | [SCCs] | 90 days | as above; log lines scrubbed of user paths | ☐ |
| 3 | Newsletter | News | Subscribers | Email, language, consent record, opens/clicks | [Newsletter provider] | [SCCs/DPF] | Until unsubscribe + 30 days | Double opt-in, 2FA on provider | ☐ |
| 4 | Community (Discord) | Community, support | Server members | Profile, messages | Discord (independent controller) | Discord terms | Per Discord | Moderation policy | n/a |
| 5 | Support email | Answer players | Correspondents | Email, message content | [Email provider] | [SCCs] | 12 months | 2FA, role mailbox | ☐ |
| 6 | Press & creator CRM | Outreach | Journalists, creators (business contacts) | Name, outlet, business email, coverage | [Spreadsheet/CRM provider] | [SCCs] | 24 months after last contact | Access limited to marketing | ☐ |
| 7 | Playtester NDAs and Playtest invites | Testing | Testers | Name, email, signature, Steam invite status | [E-signature provider], Valve | [SCCs] | Contract term + 6 years | 2FA | ☐ |

## DPA checklist per processor (before the demo RC)
- [ ] Processor's standard DPA accepted/signed (usually in their dashboard); PDF saved
- [ ] Sub-processor list reviewed and linked
- [ ] Data region chosen (EU where offered)
- [ ] Transfer mechanism named (SCCs / Data Privacy Framework)
- [ ] Deletion-by-install-ID path tested (telemetry, crash)
