# Tinybrowser development

Preserve the Chawan engine and history. Keep personal browser code under
`personal/`; avoid adding another TUI framework or runtime dependency.

- Read `UPSTREAM.md` before modifying upstream files.
- UI commands use a fixed dispatcher. Never evaluate command-bar input as JS
  or interpolate page contents/URLs into shell commands.
- Preserve user configs and browsing data during install and upgrades.
- Keep website JS disabled by default and image support opt-in at the terminal
  protocol level (no assumption that tmux can display pictures).
- Run `node --test tests/personal.test.cjs` after command changes.
- For browser/API changes, compile and run `tests/smoke.py` on packaged Linux
  binaries. Use CI for x86_64 and ARM64; never infer GUI behavior from mocks.
- `work/` and `dist/` are ignored. Never commit credentials, history, cookies,
  personal bookmarks, or generated packages.
- Releases use `tiny-v*` tags matching `VERSION`, only after CI passes.
