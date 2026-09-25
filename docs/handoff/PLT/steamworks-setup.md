# Steamworks partner setup — exact steps

Everything the code needs is in place; these steps need a Steamworks partner account with admin rights.
After each numbered section, the file to update in the repo is named.

## 1. Apps and depots (PLT-0056, PLT-0174)

1. Steamworks → *Create new app* is done by Valve when the app fee is paid; the **full game** app id arrives first.
2. On the full game's page: *All Associated Packages, DLC, Demos and Tools* → **Add demo** → name
   `Suture & Steel Demo`. Valve creates the demo app id and links it to the base game (store association).
3. For **each** app (demo, full): SteamPipe → Depots → add three depots:
   - `Suture & Steel Demo Windows` — Operating system *Windows*, 64-bit
   - `Suture & Steel Demo macOS` — *macOS*
   - `Suture & Steel Demo Linux` — *Linux + SteamOS*
4. Put the ids into `src/platform/editions.ts` (`steamAppId`, `depots.windows/mac/linux` for both editions),
   run `npm run steam:config` and commit. `scripts/steam-config.mjs --strict` (used by CI) fails until this is done.

## 2. Installation / launch options (PLT-0055)

Enter exactly the table generated in `steam/output/<edition>/launch_options.md` (run `npm run steam:config`):
Installation → General → Launch Options: one default and one *Launch in safe mode* (`--safe-mode`) entry per OS.
Linux: tick *Linux + SteamOS*; on the Deck tab choose the native Linux build unless PLT-0163 decides otherwise.

## 3. Steam Cloud — Auto-Cloud (PLT-0046)

Application → Steam Cloud, for **each** app:

- Byte quota per user: **10485760** (10 MB); number of files per user: **50**.
- Auto-Cloud root paths (Root / Subdirectory / Pattern / OS / Recursive):

| Root | Subdirectory | Pattern | OS | Recursive |
|---|---|---|---|---|
| `WinAppDataRoaming` | `suture-and-steel/demo` (full: `suture-and-steel/full`) | `*.json` | Windows | yes |
| `MacAppSupport` | `suture-and-steel/demo` | `*.json` | macOS | yes |
| `LinuxXdgDataHome` | `suture-and-steel/demo` | `*.json` | Linux + SteamOS | yes |

- Root overrides so a save made on one OS syncs to the others: add overrides *Original root* `WinAppDataRoaming`
  → *New root* `MacAppSupport` for macOS and → `LinuxXdgDataHome` for Linux, both with *Replace path* empty.
- Note: on Linux `settings.json` lives in `$XDG_CONFIG_HOME` and is deliberately *not* synced (machine-specific);
  the `*.json` pattern under the data home covers profile + slots. `*.bak` and `*.damaged` are not matched
  (they end in `.bak` / `.damaged`), so backups stay local.
- Save → Publish.

Test (PLT-0046/0047): see `hardware-qa.md` §Cloud.

## 4. Rich presence (PLT-0045)

Community → Rich Presence Localization → upload `steam/output/<edition>/rich_presence_english.vdf` for each app.
Verify: a friend's list shows "Chapter I — operating on Jost, drover (Demo)" while you play op I-1.

## 5. Achievements (PLT-0049)

Stats & Achievements → Achievements: create one entry per object in `steam/output/<edition>/achievements.json`
(API name, display name, description, hidden flag). Icons (64×64 JPG, locked and unlocked) come from the art team;
paths are listed in the JSON. Publish. Achievement unlocks are already wired; QA builds reset them with
Ctrl+Shift+F9.

## 6. Build account and uploads (PLT-0054, PLT-0052)

1. Create a new Steam account `sns-build` (unique e-mail on the company domain), no purchases.
2. Steamworks → Users & Permissions → add it with **only**: *Edit App Metadata* off, *Publish* off,
   *Upload builds / SteamPipe* **on** for the two apps. No financial or user-management rights.
3. On a trusted machine: install steamcmd, run `steamcmd +login sns-build` once, enter the Steam Guard code.
   This writes `~/Steam/config/config.vdf` with the sentry. Store it as the GitHub secret
   `STEAM_CONFIG_VDF` (`base64 -w0 ~/Steam/config/config.vdf`) and the user name as `STEAM_BUILD_USERNAME`.
   Delete the local copy.
4. **Recovery:** if uploads start failing with a Steam Guard prompt (sentry expired or revoked), repeat step 3 and
   replace the secret. If the account is compromised: remove it from the partner group (step 2), change its
   password, create a new build account.
5. Branches: SteamPipe → Builds → create `qa` (password) and `beta` (password for the demo). Never let CI set
   `default` (the script refuses).

## 7. Screenshots, overlay, Deck (PLT-0042, PLT-0048, PLT-0076, PLT-0164)

No Steamworks settings needed beyond the defaults; see `hardware-qa.md` for the verification steps.
