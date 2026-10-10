# Chawan upstream

Tinybrowser preserves Chawan's Git history, based on the annotated tag
`v0.4.4` (commit `029a6dac`, full hash available with `git rev-parse v0.4.4^{commit}`).

Official source: https://git.sr.ht/~bptato/chawan
Mirror: https://codeberg.org/bptato/chawan
Documentation: https://chawan.net/doc/index.html

The personal layer lives in `personal/`, `scripts/`, and `.github/workflows/`.
Engine changes are intentionally limited to small API additions and one fix:

- `pager.choose(options)` and `pager.prompt(label, current)` in `src/init.js`.
- `styling` as a per-load `gotoURL` option in `src/local/pager.nim`.
- Expose the current styling mode on `BufferInit` in `src/server/bufferiface.nim`.
- Honor disabled author CSS for inline `<style>` elements in `src/html/dom.nim`.
- Recognize standalone Escape after a 150 ms grace period in the terminal
  input parser; preserve Meta/arrow sequences arriving inside that interval.

Upstream notices remain in `UNLICENSE`, `res/license.md`, and `README.upstream.md`.
No Chromium, Electron, Node.js, Python, or fzf is needed at runtime.

To review an update, fetch the official source, create an update branch, merge
the chosen stable tag, and run CI before publishing a new `tiny-v*` release.
Never reset the personal branch to upstream or publish untested master builds.
