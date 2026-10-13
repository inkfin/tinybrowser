# 0.2.0 validation (2026-10-13)

Local Darwin ARM64 checks passed with a freshly compiled and packaged browser:

- Node checks covering the fixed command dispatcher, menu cancellation,
  URL handling, safe external opening, and the release installer.
- Real 100x32 and 45x20 PTYs: single-click navigation, middle-click background
  tabs, right-click menus, drag selection, and exact selected-text copying.
- Real loopback HTTP with chained 302 responses: background navigation keeps
  focus, tab switching reaches the final URL, and foreground history works.
  Input/submit controls cannot be mistaken for links or submitted by a
  middle-click; ordinary text editing still works.
- Reading position survived website CSS changes and reload; the chosen CSS
  mode survived reload too.
- Shell metacharacters in a URL reached a controlled external opener as one
  literal argument. Both Linux and Darwin helper branches were exercised.
- Existing Unicode, code/table, command bar, finder, PNG Kitty protocol,
  profile preservation, and clean-exit checks still passed.
- All macOS executables use system dynamic libraries only. Local Homebrew
  archives require macOS 26, so this development package is not a release
  artifact; macOS 15 release compatibility must be verified by CI.
- Live HTTPS text rendering of https://chawan.net/ passed with the packaged
  launcher and the default macOS certificate bundle.
- Installer tests keep an old native executable running while replacing its
  file, and inject a copy failure to verify that the old file is retained.
  Replacement is atomic per file, not for the entire installed version.

External-opening tests use temporary fake openers and clipboard sinks. They
verify routing and argument safety, not the installed GUI browser or system
clipboard. The real X login page in Chawan remained blank and reported a missing
`ReadableStream` API. The chosen product path is an explicit handoff to the
system browser with `:x`; no X login, timeline, or write API is implemented.
The image visibility toggle remains temporary: reload restores the configured
default. Persistent sidebar, live command filtering, and a cross-tab picker
remain future work.

Linux x86_64/ARM64 and Darwin ARM64/Intel package acceptance passed on
commit `e06792fa`:
https://github.com/inkfin/tinybrowser/actions/runs/38341800977

All four native runners passed 32 command/installer checks, built the browser,
and ran the complete PTY/HTTP/HTTPS suite on the extracted archive. Both Linux
executables are static musl ELF. Both Darwin builds use macOS 15 runners,
check the deployment minimum of static archives, and reject non-system
dynamic-library dependencies in the shipped executables.

The tagged build repeated all four platform checks, then published the release:
https://github.com/inkfin/tinybrowser/actions/runs/38342283964
https://github.com/inkfin/tinybrowser/releases/tag/tiny-v0.2.0

All four final Release archives were downloaded again and matched their
published SHA256SUMS. Sizes below are decimal MB; unpacked sizes count regular
file bytes, not filesystem allocation:

| Package | Compressed | Unpacked |
| --- | ---: | ---: |
| Linux x86_64 | 6.14 | 12.40 |
| Linux ARM64 | 6.47 | 11.82 |
| Darwin ARM64 | 5.42 | 10.37 |
| Darwin Intel | 5.23 | 10.67 |

The public versioned installer was downloaded, compared with the tagged source,
and executed into an isolated prefix on the development Mac. Its published
Darwin ARM64 package reported Tinybrowser 0.2.0 and rendered both the Unicode
fixture and live HTTPS with a fresh profile and the default system CA bundle.
The Darwin binary reports that the engine sandbox is unavailable; Linux tests
retain Chawan's enabled sandbox.

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
