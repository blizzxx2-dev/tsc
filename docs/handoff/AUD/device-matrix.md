# Device resilience matrix (AUD-0024)

Run on the Electron build with the F4 overlay open (context state, latency, bus meters).
Pass = audio continues within 1 s with no crash, no permanent silence, no doubled music.

| # | Action | Windows 11 | macOS 14+ | Ubuntu 24.04 | Steam Deck |
|---|---|---|---|---|---|
| 1 | Unplug wired headphones mid-operation | | | | |
| 2 | Plug headphones back in | | | | |
| 3 | Connect Bluetooth headphones mid-operation | | | | |
| 4 | Disconnect Bluetooth headphones | | | | |
| 5 | Change the OS default output device in settings | | | | |
| 6 | Change the device's sample rate (44.1 ↔ 48 kHz) in OS settings | | | | |
| 7 | Sleep the machine during a boss fight, wake it | | | | |
| 8 | macOS: take a phone call via Continuity (context becomes `interrupted`) | n/a | | n/a | n/a |
| 9 | Alt-tab away for 5 min with "Mute when unfocused" on; return | | | | |
| 10 | Pick a non-default device in Sound → Mix → Output device (where shown) | | | | |
| 11 | Disconnect the selected device from #10 | | | | |

What the code does: `devicechange` → `recover()` resumes the context and re-applies the chosen
sink; a closed context is rebuilt; `onstatechange` resumes after `interrupted`/unexpected
`suspended`; focus loss fades the master in 200 ms. Report failures with the F4 overlay screenshot.
