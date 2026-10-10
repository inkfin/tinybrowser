# Initial validation (2026-10-10)

Passed on the development Mac with Nim 2.2.10:

- Six command-dispatch and cancellation checks (`node --test`).
- Real packaged binary in 100x32 and 45x20 PTYs: Chinese, code blocks, tables,
  menu navigation, command bar, finder, Escape, per-page CSS round trip, and exit.
- A decoded PNG transmitted with the Kitty graphics protocol (`a=T,f=100`).
- Local-prefix installation with spaces in the path; user config preserved.
- Live HTTPS text rendering of https://chawan.net/ and https://docs.python.org/3/.

Linux x86_64/ARM64 static builds and GitHub Release publication are pending
GitHub CLI workflow authorization. The prepared pipeline lives in
`docs/pending-linux-workflow.yml`. Move it into `.github/workflows/linux.yml`
after authorization, push main, inspect both CI jobs, then tag `tiny-v0.1.0`.

The Mac build is a development check; it does not prove Linux sandbox behavior,
Linux static linking, or image rendering in every terminal. Generated terminal
captures remain local under `work/screens/`.
