# Initial validation (2026-10-10)

Passed on the development Mac with Nim 2.2.10:

- Six command-dispatch and cancellation checks (`node --test`).
- Real packaged binary in 100x32 and 45x20 PTYs: Chinese, code blocks, tables,
  menu navigation, command bar, finder, Escape, per-page CSS round trip, and exit.
- A decoded PNG transmitted with the Kitty graphics protocol (`a=T,f=100`).
- Local-prefix installation with spaces in the path; user config preserved.
- Live HTTPS text rendering of https://chawan.net/ and https://docs.python.org/3/.

GitHub workflow authorization is complete. The pipeline is enabled at
`.github/workflows/linux.yml`. Linux x86_64/ARM64 static builds and the first
GitHub Release are being verified.

The Mac build is a development check; it does not prove Linux sandbox behavior,
Linux static linking, or image rendering in every terminal. Generated terminal
captures remain local under `work/screens/`.
