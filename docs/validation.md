# Initial validation (2026-10-10)

Passed on the development Mac with Nim 2.2.10:

- Six command-dispatch and cancellation checks (`node --test`).
- Real packaged binary in 100x32 and 45x20 PTYs: Chinese, code blocks, tables,
  menu navigation, command bar, finder, Escape, per-page CSS round trip, and exit.
- A decoded PNG transmitted with the Kitty graphics protocol (`a=T,f=100`).
- Local-prefix installation with spaces in the path; user config preserved.
- Live HTTPS text rendering of https://chawan.net/ and https://docs.python.org/3/.

Linux x86_64 and ARM64 validation passed:
https://github.com/inkfin/tinybrowser/actions/runs/38050840079

- Static musl ELF binaries, with no dynamic interpreter dependency.
- Command logic, shell syntax, Unicode/code/table rendering, native popup menu,
  command bar/finder, standalone Escape, CSS round trip, install and clean exit.
- Decoded PNG sent using the Kitty graphics protocol.
- Live HTTPS access to https://chawan.net/ from each packaged Linux browser.
- Both architecture archives and SHA256SUMS uploaded as Actions artifacts.

The `tiny-v0.1.0` release workflow passed all checks and published both architectures:
https://github.com/inkfin/tinybrowser/actions/runs/38051060244

The Linux runs keep Chawan's sandbox enabled. These checks cover the fixtures
and one live HTTPS site; they do not guarantee every website or visually verify
every terminal's graphics implementation. Terminal captures are available in
the `terminal-checks-*` Actions artifacts; local captures are under `work/screens/`.


Published release:
https://github.com/inkfin/tinybrowser/releases/tag/tiny-v0.1.0

Both final Release archives were downloaded again and verified against their
SHA256SUMS files. Sizes (decimal MB): x86_64 6.13 compressed / 12.38 file bytes;
ARM64 6.46 compressed / 11.81 file bytes. The source and default profile remain
free of browsing data and credentials.
