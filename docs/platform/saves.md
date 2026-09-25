# Saves, settings and where they live

## Files

Each user has one save folder per edition:

| OS | Saves (Steam Auto-Cloud root) | Settings | Logs |
|---|---|---|---|
| Windows | `%APPDATA%\suture-and-steel\<edition>\<user>\` (`WinAppDataRoaming`) | same folder | `%LOCALAPPDATA%\suture-and-steel\logs\<edition>\` |
| macOS | `~/Library/Application Support/suture-and-steel/<edition>/<user>/` (`MacAppSupport`) | same folder | `~/Library/Logs/suture-and-steel/<edition>/` |
| Linux / Deck | `$XDG_DATA_HOME/suture-and-steel/<edition>/<user>/` (`LinuxXdgDataHome`, default `~/.local/share`) | `$XDG_CONFIG_HOME/suture-and-steel/<edition>/<user>/` | `$XDG_STATE_HOME/suture-and-steel/<edition>/logs/` |
| Browser | IndexedDB `suture-and-steel` (localStorage fallback), key prefix `<edition>/local/` | same | — |

`<edition>` is `demo` or `full`; `<user>` is `steam-<first 12 hex of sha256(SteamID)>` under Steam or `local`
otherwise, so people sharing a PC keep separate progress. The Documents folder is never used (OneDrive
redirection). Chromium's own profile and caches go to the local/cache folder, never into the cloud folder.

| File | Contents |
|---|---|
| `profile.json` | edition, build, content-id table version, campaign resume point, best rank/score per operation, unlocks, achievements (and offline queue), playtime |
| `slotauto.json`, `slot1–3.json` | campaign position + load-menu metadata (chapter title, patient, playtime, timestamp, field thumbnail) |
| `settings.json` | every player preference (`src/core/settings/schema.ts`) |
| `*.bak` | previous good copy of each file |
| `*.damaged` | a file that failed its checksum, kept for support |

Every file is a JSON envelope `{"format":"suture-and-steel","kind":…,"sum":<FNV-1a of data>,"data":…}`.

## Guarantees

- **Atomic writes** (desktop): write `*.tmp`, fsync, copy the current valid file to `*.bak`, rename over the
  target, fsync the directory. `tests/desktop.test.ts` kills a writer process mid-write repeatedly and checks
  the save is always readable.
- **Recovery order:** `profile.json` → `profile.json.bak` → rebuilt from `slotauto.json` → fresh journal. The player
  is told when a repair happened ("Your journal was damaged and restored from a backup").
- **Migrations:** `MIGRATIONS[n]` upgrades version n → n+1 (`src/core/save/codec.ts`); v1 (M0 localStorage, incl.
  the working-title key `grim-apothecary.save`) is imported on first run and its volume moves into settings.
  Fixture saves for every released format live in `tests/fixtures/saves/` and are loaded on every CI run.
- **Forward compatibility:** unknown fields are preserved and the version number never goes down, so going back
  from a beta branch loses nothing.
- **Disk full / read-only:** saving warns once ("Your journal could not be written…"), retries with backoff up to
  every 30 s, and the game keeps running.
- **Saving never blocks a frame:** reads come from a boot snapshot; writes are queued, coalesced per file and
  performed by the main process.

## Autosave behaviour

The game autosaves when each story scene or operation **begins** (that step becomes the resume point) and after
each operation result — never during an operation. Quitting in the middle of an operation therefore resumes at
that operation's briefing. The quill in the bottom-right corner is shown while a save is being written.

## Demo → full game

The full game detects the demo's journal (`…/suture-and-steel/demo/<user>/profile.json`) on first launch and
offers to import it: best ranks carry over, the campaign resumes at the same story beat (or at the start of
Chapter III if the demo was finished). Ids are mapped through the frozen content-id table
(`src/platform/carryover.ts`).

**Limitation (FAQ):** Steam Cloud keeps the demo and the full game apart (different app ids), so demo progress
can only be imported **on the computer where the demo was played**. If you played the demo elsewhere, copy the
demo save folder above to this computer first, or start afresh. Uninstalling the demo does not delete its save
folder, so the import still works afterwards.

## Uninstalling and deleting data

Uninstalling through Steam removes the game files only; saves, settings and logs stay in the folders above
(and in Steam Cloud). *Delete all local data* (desktop, options) removes this edition's saves and settings for
the current user after two confirmations and restarts the game; Steam Cloud copies are removed on the next sync.
