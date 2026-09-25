# Decision log

Every scope, legal, pricing, vendor and localisation decision gets an entry here (OPS-0004). Other
documents link to entries by id (`D-0007`). Add new entries at the bottom; never rewrite an accepted
entry — supersede it with a new one and set the old entry's status to `Superseded by D-xxxx`.

**Status values:** `Accepted` (in force) · `Proposed` (drafted, waiting for the named owner) ·
`Pending counsel` (waiting for the games-IP lawyer, see `docs/handoff/OPS/README.md`) · `Superseded`.

**Roles** (people are assigned in `docs/production/team.md` once hired/contracted): Owner (project
owner / creative director, final say), Producer, QA lead, Loc lead, Marketing lead, Counsel.

| Field | Meaning |
|---|---|
| Date | Day the decision was taken or proposed |
| Decision | What we will do, in one or two sentences |
| Alternatives | What else was considered and why it lost |
| Owner | Role accountable for the decision |
| Link | Roadmap task(s) and supporting document |

---

### D-0001 · Two-week sprints from Monday 28 September 2026
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Producer
- **Decision:** Work runs in two-week sprints starting Mondays; sprint 1 starts 2026-09-28. Ceremonies and the board rules are in [cadence.md](cadence.md).
- **Alternatives:** one-week sprints (too much ceremony for a small team with contractors); Kanban only (no natural checkpoint for a playable build and the Steam `qa` branch).
- **Link:** OPS-0001, OPS-0002.

### D-0002 · Target Steam Next Fest: February 2027 edition; fallback June 2027
- **Date:** 2026-09-25 · **Status:** Proposed (dates to be confirmed from Steamworks — handoff OPS-0104/0105) · **Owner:** Owner
- **Decision:** Plan the demo for the February 2027 Next Fest (planning dates 22 Feb – 1 Mar 2027). The June 2027 edition is the fallback; the go/no-go on 18 Jan 2027 decides.
- **Alternatives:** October 2026 (store page could not be live 3 months ahead; demo not at release quality); June 2027 as primary (safer for art/loc but pushes 1.0 into 2028 and delays wishlist compounding by four months).
- **Link:** OPS-0010, OPS-0027, OPS-0104; [schedule.md](schedule.md), [nextfest/plan.md](nextfest/plan.md).

### D-0003 · Demo language set
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Loc lead
- **Decision:** The demo ships English plus **German, French, Spanish (Spain), Polish and Brazilian Portuguese** (Latin script, matching the ART glyph audit and the ENG Latin Extended-A font subsetting). **Russian and Simplified Chinese** are a stretch with a go/no-go at demo feature lock (11 Dec 2026), decided on whether the ENG Cyrillic/CJK font pages and atlas budget are in. **Italian, Japanese and Korean** (and any stretch language not taken) are added at Beta.
- **Alternatives:** EN-only demo (loses the DE/PL/BR audiences that over-index for dark fantasy and horror on Steam); full 10 languages for the demo (CJK font cost and LQA time do not fit before Next Fest).
- **Link:** LOC-0001, [docs/loc/languages.md](../loc/languages.md).

### D-0004 · Spanish variant: Spain first
- **Date:** 2026-09-25 · **Status:** Proposed (confirm with store-traffic data by 15 Jan 2027) · **Owner:** Loc lead
- **Decision:** Translate into Spanish for Spain (`es-ES`) for the demo. Re-check Steamworks traffic by country on the coming-soon page on 15 Jan 2027; if Latin-American traffic exceeds Spain's by more than 2:1, switch the vendor brief to neutral Latin-American Spanish before translation starts. The other variant is a Post option (LOC-0108).
- **Alternatives:** neutral LatAm Spanish (larger player base, but vosotros/usted register matters to the archaic tone and the ES LSP shortlist is Spain-based).
- **Link:** LOC-0003.

### D-0005 · Right-to-left scripts out of scope for 1.0
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Loc lead
- **Decision:** Arabic and Hebrew are not planned for 1.0; layout code needs no bidirectional support. Revisited in the post-launch language review (LOC-0108).
- **Link:** LOC-0005.

### D-0006 · Localisation architecture
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Loc lead (with ENG/UIX)
- **Decision:** In-house ICU MessageFormat runtime (`src/i18n`, no dependency), flat key tables `src/i18n/strings/<lang>.json`, lazy locale chunks, XLIFF 1.2 as the TMS exchange format. Menus and HUD use keys. Simulation text (rating labels, popups, loss reasons) is resolved by English source text through `tSource()` until GAM moves the simulation to storing keys (LOC-0011). Story/operation content keeps English in code and is addressed by stable line ids (`s1-2.014`, `op1-2.p0.1`) for export, VO and subtitles; runtime content translation loads `loc/content/<lang>.json` when the NAR/CON op-schema work lands.
- **Alternatives:** i18next / FormatJS (adds ~40 kB and a second message syntax to review; we only need plural/select/number); keys for story content inside the scripts (would make the NAR writing workflow unreadable).
- **Link:** LOC-0006…0018, [docs/loc/keys.md](../loc/keys.md).

### D-0007 · `hexstone` is the id and display name (resolves the `warpshard` conflict)
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Producer (with GAM and NAR leads)
- **Decision:** The cursed mineral is **Hexstone** everywhere: entity kind `hexstone` (already in `src/surgery/entities.ts`, `EmbeddedKind`), display name "Hexstone", termbase entry "Hexstone". NAR's `hexshard` proposal is declined: "hexstone" is already in code, content and callouts, and both avoid the Games Workshop term *warpstone* equally well. **Migration:** no build containing `warpshard` has been distributed (there are no player saves or replays to migrate); PLT owns rejecting unknown kinds in the save v2 loader. GAM and NAR task wording that still says `warpshard`/`hexshard` is to be updated by those owners (see handoff OPS-0054).
- **Alternatives:** `hexshard` (NAR) — equally safe, but a rename with no benefit.
- **Link:** OPS-0054.

### D-0008 · Rank letters and rating words
- **Date:** 2026-09-25 · **Status:** Accepted (rank letters) / Pending counsel (rating words) · **Owner:** Owner
- **Decision:** Rank letters XS/S/A/B/C stay Latin capitals in every language (translator note, LOC-0010). Whether the COOL/GOOD/BAD/MISS words and the "XS" rank are kept or replaced waits for the counsel trade-dress memo (OPS-0049/0050); the in-game text is already keyed (`rating.*`) so a change is a string edit.
- **Link:** LOC-0010, LOC-0037, OPS-0050.

### D-0009 · Demo goes public one week before Next Fest
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Marketing lead
- **Decision:** Release the demo publicly on **Monday 15 Feb 2027**, one week before the festival: early players, reviews and discussion threads make the festival page look alive, and the first-week hotfix window (OPS-0129) lands before festival traffic. Press and creators get access on 8 Feb (T-2 weeks).
- **Alternatives:** release at festival start (single spike, but launch-day bugs meet the largest audience); release months earlier (Valve's Next Fest eligibility is for games whose demo is new to the event — confirm the current rule in OPS-0105 before committing).
- **Link:** OPS-0109.

### D-0010 · Demo stays available after 1.0
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Owner
- **Decision:** The demo remains on Steam after launch, updated to the 1.0 build of Chapters I–II, with an end screen that tells players their demo save carries over (PLT carry-over). It is retired only if telemetry shows demo players converting worse than store-page visitors.
- **Link:** OPS-0131.

### D-0011 · Beta testing through a separate Steam Playtest app
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** QA lead
- **Decision:** Chapters III–V are tested in a Steam Playtest app (invite waves of 200 → 1,000 → open signup), keeping the public demo stable and spoiler-free.
- **Link:** OPS-0132, [release/demo-release.md](release/demo-release.md).

### D-0012 · Store release window "2027"
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Marketing lead
- **Decision:** The coming-soon page shows "2027"; it is replaced by a date at the Beta release-date decision (OPS-0133).
- **Link:** OPS-0083.

### D-0013 · Demo scope (MoSCoW)
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Owner
- **Decision:** As listed in [moscow.md](moscow.md). Challenge mode, alternate disciplines and full visual-novel voice-over are Won't for the demo.
- **Link:** OPS-0025.

### D-0014 · Chapters III–V scope
- **Date:** 2026-09-25 · **Status:** Proposed (lock at Alpha kickoff, 1 Mar 2027) · **Owner:** Owner
- **Decision:** As listed in [scope-ch3-5.md](scope-ch3-5.md): five operations per chapter, two Malison hours per chapter (III Prime + Terce, IV Sext + None, V Vespers + Compline), the diagnosis and field-triage disciplines at 1.0, forensic/inquisition and bone-setting as post-launch free updates.
- **Link:** OPS-0028.

### D-0015 · Localisation release gating by sign-off
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Loc lead
- **Decision:** A language appears in the in-game menu and the Steamworks language list only when its lead reviewer has signed `docs/loc/signoff/<code>-demo.md`; `src/i18n/locales.ts` `shipped` flags are enforced against those files by `tests/i18n.test.ts`.
- **Link:** LOC-0054.

### D-0016 · Hotfix service levels for the demo
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** QA lead
- **Decision:** For the first two weeks after the demo release and through Next Fest: S1 fixed and shipped within 24 h, S2 within 72 h, each update with Steam patch notes. See [release/hotfix-policy.md](release/hotfix-policy.md).
- **Link:** OPS-0129.

### D-0017 · Funding route
- **Date:** 2026-09-25 · **Status:** Proposed · **Owner:** Owner
- **Decision (recommended):** Self-fund to Next Fest; prepare the publisher/fund pitch now and open conversations only with Next Fest data in hand (March 2027). See [budget/funding.md](budget/funding.md).
- **Link:** OPS-0038.

### D-0018 · Price proposal
- **Date:** 2026-09-25 · **Status:** Proposed (decide at Beta) · **Owner:** Owner
- **Decision (recommended):** USD 19.99 base, Valve's recommended regional pricing, 10 % launch discount. See [release/pricing.md](release/pricing.md).
- **Link:** OPS-0134.

### D-0019 · EULA approach
- **Date:** 2026-09-25 · **Status:** Pending counsel · **Owner:** Owner
- **Decision (recommended):** Rely on the Steam Subscriber Agreement for the demo and 1.0 with no custom EULA; a short in-game data notice covers telemetry. Revisit a custom EULA only if mods/Workshop ship. Draft supplemental terms in [legal/eula-draft.md](legal/eula-draft.md) are ready if counsel advises otherwise.
- **Link:** OPS-0067.

### D-0020 · Streaming and monetisation
- **Date:** 2026-09-25 · **Status:** Accepted (statement), licences to confirm · **Owner:** Marketing lead
- **Decision:** Creators may stream and monetise videos of the game. Every music and SFX licence must allow this without Content ID claims before it is signed. See [legal/streaming-policy.md](legal/streaming-policy.md).
- **Link:** OPS-0071.

### D-0021 · Change control after feature lock
- **Date:** 2026-09-25 · **Status:** Accepted · **Owner:** Producer
- **Decision:** After a feature lock, any addition names an equal-sized cut recorded in [cut-list.md](cut-list.md). See [change-control.md](change-control.md).
- **Link:** OPS-0017, OPS-0026.
