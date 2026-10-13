Tinybrowser 0.2.0 adds macOS downloads and more consistent keyboard/mouse browsing.

- Linux x86_64/ARM64 and macOS 15+ Intel/Apple Silicon packages. Third-party libraries are linked statically; no Homebrew runtime is needed.
- Single-click links, middle-click links into background tabs, and drag-select text. Space and right-click share the same actions and accurate shortcut labels.
- Preserve reading position when switching website CSS; preserve JS, cookie and styling settings on reload.
- Open X in the system browser with `:x`; open the current web page with `gx` / `:external`, or a link from its context menu. X login and interaction happen in the external browser.
- Address/search handling, current-page cookie settings, and macOS/Wayland/X11 clipboard helpers. Website JavaScript remains off by default.
- One-command installer automatically selects the platform, verifies SHA256, and retains existing profiles and data.

Install:

```sh
curl -fsSL https://raw.githubusercontent.com/inkfin/tinybrowser/tiny-v0.2.0/scripts/get.sh | sh
~/.local/bin/tinybrowser
```

Existing custom configs are preserved, so newly added shortcuts are not merged automatically. New commands and menu actions remain available; see the bundled default config to add bindings.

Linux requires system CA certificates. Images require a Kitty/Sixel-capable terminal. The packages are checked in actual PTYs; this does not certify every physical terminal, website, or external browser installation. Windows native builds, a persistent sidebar, live command filtering, and X inside the terminal are not included.
