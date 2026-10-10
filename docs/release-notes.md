Tinybrowser's first personal-browser release, based on Chawan 0.4.4.

- Vim navigation, a centered native popup menu (Space), command finder (Ctrl-P), and named command bar (:).
- Images enabled through Kitty/Sixel, with text-first reading styles and per-page website-CSS toggle.
- Static Linux x86_64 and ARM64 builds. No Chromium or extra TUI runtime.
- Website JavaScript and cookies disabled by default; explicit per-page JS toggle available.

Download the archive for your CPU, verify it against the corresponding SHA256SUMS file, extract, and run `./bin/tinybrowser`, or install with `./install.sh`.

Requires Linux with a compatible terminal and system CA certificates (`ca-certificates`).
Complex JavaScript applications and arbitrary websites are not guaranteed to work.
Kitty/Sixel image display can be limited by tmux or terminal compatibility.
