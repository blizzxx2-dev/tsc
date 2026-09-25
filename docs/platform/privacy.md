# Privacy — crash reports and data the game stores (draft section for the privacy policy)

> Draft for legal review (see `docs/handoff/PLT/README.md`, PLT-0125/PLT-0095). Plain language first.

## What Suture & Steel stores on your computer

- Your journal (campaign progress, best ranks, unlocks, achievements, playtime) and your settings, in the folders
  listed in `docs/platform/saves.md`. When you play through Steam, the folder name contains a one-way hash of your
  SteamID so that several people can share a PC; the SteamID itself is not written into save files.
- Log files of the last five sessions (at most 25 MB). Before anything is written to a log, your user name, computer
  name, Steam persona name and SteamID are removed.

## Crash reports (optional)

On first launch the game asks whether it may send anonymous crash reports. You can change your answer at any time
in **Options → Privacy → Crash reports**. Nothing is uploaded unless you said yes.

A crash report contains: the error message and stack trace, the game's build id and edition, the operating system
and its version, the graphics-card model and graphics settings tier, and the last 200 lines of the game log (already
scrubbed as above). For crashes of the game engine itself (Chromium), a minidump of the crashed process is sent.
Reports never contain your name, e-mail address, SteamID, files, or save data.

Reports are processed by our crash-reporting provider (to be named: Sentry/BugSplat/Backtrace, see
`docs/handoff/PLT/crash-backend.md`) in the EU/US, kept for 90 days and used only to fix bugs.

## Support bundles

In QA builds F8, and in all builds *Options → Support → Export*, write a zip of your logs, saves and settings to
your computer. It is only sent anywhere if you attach it to a support request yourself.
