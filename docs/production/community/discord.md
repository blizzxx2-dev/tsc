# Community plan — Discord, moderation, Steam discussions (OPS-0115 … OPS-0117, OPS-0124, OPS-0126)

Owner: Marketing lead (community). Server creation, bots and role setup are human steps (handoff OPS-0115).

## Discord server specification (OPS-0115)
**Name:** Suture & Steel — The Hospice · **Invite:** discord.gg/sutureandsteel (vanity once available)
· linked from the game (title/demo-end screen), website, Steam page and press kit.

| Category | Channel | Who can post | Purpose |
|---|---|---|---|
| WELCOME | #rules | staff | Rules (below) — reacting ✓ grants the *Patient* role (verification gate) |
| | #announcements | staff | News; follow-able by other servers |
| | #roles | staff | Language roles (EN/DE/FR/ES/PL/PT-BR), notification roles |
| THE HOSPICE | #general | Patient | Chat |
| | #screenshots | Patient | Images/clips only (slow-mode 30 s) |
| | #lore | Patient | Story discussion; spoiler tags required for post-demo content |
| DEMO | #demo-feedback | Patient | Structured feedback (pinned form) |
| | #bug-reports | Patient | Forum channel; template below; staff tag `confirmed`/`fixed` |
| | #loc-feedback | Patient | Translation issues, per-language tags |
| STAFF | #mod-log, #mod-chat | Moderators | AutoMod alerts, escalations |

**Roles:** Owner/Dev (admin, 2FA required), Moderator (manage messages, timeout members, view audit
log — no ban/admin by default; bans by Senior Mod), Patient (verified member), language roles,
Playtester (later).
**Safety:** verification level *Medium* (account > 5 minutes old, verified email); **AutoMod** rules
for slurs/harassment keyword lists, mention spam (> 5 mentions), links in #general for members < 24 h,
invite links; a spam/raid bot with join-rate raid protection; 2FA requirement for moderation actions.

**Bug report template (pinned in #bug-reports):**
```
Build/version (title screen corner):
Platform (Windows/Linux/Deck) + GPU:
Operation or scene:
What happened / what you expected:
Steps to reproduce:
Screenshot or clip:
```

## Rules (published in #rules and on the website)
<!-- loc:start -->
1. Be kind. No harassment, hate speech, slurs, or personal attacks — including towards developers.
2. No NSFW content. The game is gory; real-world gore, pornography and shock images are not allowed.
3. Spoilers in spoiler tags outside #lore-free channels.
4. No piracy, key selling or account trading.
5. No advertising or self-promotion outside designated channels.
6. Don't share leaked or press builds.
7. Moderators have the final word; appeal by DM to a Senior Moderator.
<!-- loc:end -->

## Moderation policy and team (OPS-0116)
- **Team:** 2 volunteer moderators (recruited from early active members after the announce, adults,
  timezone spread EU/Americas), documented permissions as above; weekly 20-min sync with the
  community owner; moderators are credited in-game (credit obligations register).
- **Escalation ladder:** note → warning → 24 h timeout → 7-day timeout → ban. **Immediate ban:** hate
  speech, doxxing, sexual content involving minors (report to Discord Trust & Safety), threats of
  violence (report to Discord; contact law enforcement if credible).
- **Harassment of team members** is escalated to the Owner the same day; **NSFW posts** are deleted and
  logged; repeated → ban.
- Moderators never discuss unannounced plans; they route business/press requests to press@.
- All actions logged in #mod-log with reason.

## Steam discussions (OPS-0117)
For both apps: pinned **FAQ** (links to [faq.md](faq.md) text), pinned **bug-report template** (same
as Discord), pinned **known-issues thread** (updated with each patch), moderators = the Discord
moderators added as Steam community moderators for the apps.

## Community events (OPS-0124)
Screenshot and fan-art contests: written rules (eligibility 18+ or parental consent per local law,
entry period, judging criteria, prize, winner announcement date), **prize terms** (Steam keys or
merchandise; no cash prizes without counsel review of local sweepstakes/contest law), and an **IP
licence for submissions**: "You keep ownership of your entry; you grant [Company] a non-exclusive,
worldwide, royalty-free licence to display your entry on our channels with credit." Entries may not
contain third-party IP (Games Workshop, Atlus, etc.). Counsel reviews the first contest's rules (handoff OPS-0124).

## Launch-week community plan (OPS-0126)
- **Discord launch event** (scheduled event at launch hour with a dev voice stage).
- **Dev AMA** on Discord and r/SutureAndSteel on launch day +2.
- **Steam review-response rule:** reply within **48 h** to every negative review that reports a bug,
  with the fix status and patch ETA; never argue with opinions; thank constructive reviews weekly.
- Extra moderator shifts launch day to +3.

## Public roadmap (OPS-0127)
Within two weeks of launch, publish a post-launch roadmap (Steam announcement + Discord + website):
patch 1.1 (≈ 4 weeks), free update 1 (challenge pack), free update 2 (boss rush — pending engagement
data), DLC exploration; updated quarterly; items marked *planned / in progress / shipped* (from
[../release/post-launch.md](../release/post-launch.md)).
