# Steam Next Fest plan — February 2027 edition (OPS-0104 … OPS-0114, OPS-0027)

Owner: Marketing lead with Producer. Decision D-0002 (edition), D-0009 (demo timing).

## Edition (OPS-0104)
- **Target:** February 2027 Next Fest — planning dates **22 Feb – 1 Mar 2027**.
- **Fallback:** June 2027 edition.
- Valve publishes each edition's dates, registration deadline and press-preview window in Steamworks
  (Steamworks → Upcoming Events / Next Fest page). **Confirm and replace the planning dates here**
  (handoff OPS-0104). Registration deadline (planning): early January 2027. Press preview window
  (planning): the two weeks before the festival — our preview starts 8 Feb.

## Rules to confirm from Steamworks documentation (OPS-0105)
Record the answer and the date read for each; these are the rules as generally published, to be
verified for the specific edition:
| Rule | Our status | Confirmed |
|---|---|---|
| Game is unreleased (coming soon) | yes | ☐ |
| A game may take part in **one** Next Fest only | first participation | ☐ |
| Public store page live (and for how long before) | live from 17 Nov 2026 | ☐ |
| A playable demo available during the festival (demo app, reviewed) | demo app; public 15 Feb | ☐ |
| Whether a demo released earlier than a set date still qualifies | releasing 1 week before | ☐ |
| Livestream rules (broadcast via Steam, schedule) | planned | ☐ |
| Event asset specs (capsules, event cover) | ART | ☐ |

## Registration (OPS-0106)
Complete in Steamworks before the deadline; save the confirmation email and a screenshot of the
listing to `docs/production/nextfest/registration-<date>.md` (handoff).

## Marketing calendar (OPS-0107)
See [../schedule.md § Next Fest marketing calendar](../schedule.md#next-fest-marketing-calendar-ops-0107):
T-14 wk page live · T-10 store assets final · T-8 string freeze/loc (done 11 Dec) · T-6 demo RC · T-4 Valve
demo review · T-2 press preview · T-0 festival — owners per line in that table.

## Press & creator preview (OPS-0108)
- **Outreach sent 29 Jan 2027** (10 days before the 8 Feb preview) to the press list (120) and creator
  list (200), using the templates in [../community/outreach-templates.md](../community/outreach-templates.md).
- Access: Steam keys for the demo app (or the `press` branch build), embargo **15 Feb 15:00 UTC**.
- **Follow-ups on day 3** (11 Feb) to everyone who has not redeemed.

## Demo public-release timing (OPS-0109)
Decision D-0009: public on **15 Feb 2027**, one week before the festival.

## Livestreams (OPS-0110)
- **Pre-recorded 20–30 min dev playthrough** of op1-1 → op1-5 (Matins) with commentary, recorded by
  12 Feb, broadcast on loop on the store page during the festival (Steam broadcasting).
- **Two live sessions:** Tue 23 Feb 18:00 UTC (Q&A + Lauds attempt) and Sat 27 Feb 16:00 UTC (rank
  chasing with viewers' suggestions). Each needs a host, a co-host watching chat, and **two moderators**
  assigned from the Discord team.

## Festival-week operations runbook (OPS-0111)
Every day 22 Feb – 1 Mar, 10:00 and 18:00 UTC:
1. **Funnel dashboard:** Steamworks → store impressions, visits, demo installs, demo players, median
   playtime, wishlists; compare with yesterday; paste into `#nextfest` channel.
2. **Steam discussions + Discord sweep:** answer questions, tag bugs into the tracker with the `demo`
   label, escalate S1/S2 to QA immediately (hotfix policy, D-0016).
3. **Known-issues thread** (Steam + Discord) updated.
4. **Daily summary** posted at 18:30 UTC (numbers, top 3 feedback themes, fixes shipped).

## Festival event posts (OPS-0112)
Scheduled in Steamworks (Events & Announcements) in every demo language (LOC-0077):
| When | Event | Text source |
|---|---|---|
| 15 Feb | "The free demo is live" | press release Next Fest paragraph |
| 22 Feb | "Live: Next Fest dev stream" ×2 (one per session) | livestream plan |
| 2 Mar | "Thank you — what's next" | post-fest retro highlights |

## Post-fest retrospective (OPS-0113) — 8 Mar 2027
Template: wishlist delta (start vs end of fest, and vs forecast), demo players, median playtime,
completion rate of op1-5/op2-5, funnel conversion (impression → visit → wishlist; demo player →
wishlist), top 10 feedback items; decisions for Ch3–5 (feeds OPS-0029) and the contents of the demo
update within two weeks.

## Post-fest demo update (OPS-0114)
Patch addressing the **top 5 feedback items** by 15 Mar 2027, with a thank-you announcement (all demo
languages) listing what changed.

## Fallback plan (OPS-0027)
**Criteria for moving to the June 2027 edition** (any one, at the 18 Jan go/no-go):
1. Demo RC1 has open S1 bugs or more than 15 open S2 with no fix path before 5 Feb;
2. Performance budget missed on min-spec or Steam Deck with no fix scheduled;
3. Counsel clearance (title/name register/trade-dress changes) not complete;
4. Fewer than three core languages ready for sign-off by 1 Feb *and* English-only would be the fallback;
5. Registration or Valve demo review not confirmed.

**Pre-written messaging**
- *Team:* "We're moving the demo to June's Next Fest. The extra 16 weeks go to [the failing criteria];
  the scope and chapter plan stay the same; no one is asked to work longer hours."
- *Community (Discord/Steam post):* "The demo of *Suture & Steel* will be part of Steam Next Fest in
  June 2027 instead of February. We want your first operation to be as good as we can make it. Thank you
  for wishlisting — we'll share a new trailer and a behind-the-scenes post in the meantime."

**What the extra weeks are spent on:** fixing the criteria that failed first; then Should items from the
MoSCoW list (final art for remaining ailments, recorded SFX/music, voiced barks); Chapter III
pre-production continues in parallel. The Alpha date is re-planned at the post-demo re-plan (OPS-0029).

**Approval:** Owner, before the go/no-go (signature line in [../gates.md](../gates.md#demo-gono-go)).
