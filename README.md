# Tinybrowser

基于 [Chawan](https://chawan.net/) 的个人终端浏览器。保留上游 Git 历史，用一个小配置层提供 Vim 操作、原生弹出菜单、快捷命令和文字阅读排版。

浏览器不依赖 Chromium、WebKit、Electron、Node.js、Python 或 fzf。Node/Python 仅用于开发和 CI 检查。

## Linux 下载

Linux x86_64 和 ARM64 的静态构建、终端运行和 HTTPS 检查已通过。版本标签自动发布带校验和的下载包。

打开 [Releases](https://github.com/inkfin/tinybrowser/releases/latest)，按 CPU 选择：

- `tinybrowser-*-linux-x86_64.tar.gz`：Intel/AMD 64 位。
- `tinybrowser-*-linux-aarch64.tar.gz`：ARM64。

首个版本 `0.1.0` 的下载与解压大小（MB，按 1,000,000 字节）：

| 架构 | 压缩下载 | 解压文件合计 |
| --- | --- | --- |
| x86_64 | 6.13 MB | 12.38 MB |
| ARM64 | 6.46 MB | 11.81 MB |

两个正式 Release 下载包已重新下载并通过 SHA256 校验。

下载同架构的 SHA256SUMS 文件，在同一目录运行 `sha256sum -c SHA256SUMS-x86_64`（ARM64 对应 aarch64）。

```sh
tar -xzf tinybrowser-0.1.0-linux-x86_64.tar.gz
cd tinybrowser-0.1.0-linux-x86_64
./bin/tinybrowser
# 可选：安装到 ~/.local，配置不会被覆盖
./install.sh
# ~/.local/bin 在 PATH 中时：
tinybrowser https://example.org
```

使用静态链接的 musl Linux 构建；不需要安装浏览器引擎。HTTPS 仍需要系统 CA 证书（发行版的 `ca-certificates` 包）。图片需要支持 Kitty 图形协议或 Sixel 的终端，建议先在 Kitty 中直接运行。纯文字终端仍可使用文字功能。

## 操作

| 按键 | 功能 |
| --- | --- |
| `Space` | 居中菜单，`j/k` 或方向键选择，Enter 执行，Esc/q 取消 |
| `:` | 命令栏，例如 `open https://example.org`、`search Nim`、`images` |
| `Ctrl-P` | 按名称/关键词查找命令，再从匹配菜单选择 |
| `hjkl`、`gg/G`、`Ctrl-d/u` | 移动、首尾、半页；支持 `10j` 等计数 |
| `f/F` | 跟随链接提示 / 仅显示提示 |
| `/ ? n N` | 页内搜索、前后匹配 |
| `H/L`、`gt/gT`、`x` | 前后 buffer、前后标签、关闭 buffer |
| `o/O`、`r` | 打开/编辑 URL、刷新 |
| `yy/yl`、`b/a` | 复制页面/链接 URL、书签/添加书签 |
| `gi/gr` | 切换图片 / 当前页面的网站 CSS |
| `gh`、`F1`、`q` | 主页、帮助、退出 |

命令栏支持 `open/o`、`search/s`、`tabopen/t`、`buffers`、`bookmarks`、`bookmark`、`history`、`reload`、`images`、`style`、`javascript`、`copy`、`save`、`source`、`home`、`help`、`quit/q`。
输入按固定命令分派，不会当作 JavaScript 或 shell 执行。完整帮助也可在浏览器里按 F1 查看。

## 默认行为与自定义

图片默认开启；网站 JavaScript 和 Cookie 默认关闭。个人菜单脚本独立于网站 JavaScript，不需要开启网页脚本才能操作。`:javascript` 只切换当前页面。默认关闭网站 CSS，应用 88 列正文宽度、中文/代码块/表格阅读样式；`gr` 切换网站 CSS，不隐藏网站正文。

首次启动将默认配置复制到 `~/.config/tinybrowser/config.toml`。后续更新保留你的修改。历史、书签等保存在 `~/.local/share/tinybrowser/`。支持 XDG 路径，以及 `TINYBROWSER_CONFIG_DIR` / `TINYBROWSER_DATA_DIR` 指定独立配置。

主要修改入口：

- `personal/config.toml`：默认快捷键、排版、逐站策略。
- `personal/ui.js`：菜单与命令注册；运行时文件在 `share/tinybrowser/`。
- `personal/home.html` / `help.html`：主页和帮助。
- `src/`：只有需要扩展引擎时才修改。

当前版本先完成个人浏览器基础功能，没有嵌入 AI 模型或自动把网页发送给 AI。可让编码助手修改这个仓库；未来按键调用 AI 可接成按需运行的外部工具。

## 构建与发布

每次 main 推送或 PR 会在 GitHub Actions 原生 x86_64 / ARM64 runner 上编译 Alpine 静态包。两种架构都经过命令逻辑检查、真实 PTY 菜单/命令栏/排版/PNG 输出检查，成功后上传 Actions artifacts。

更新 VERSION 和 `docs/release-notes.md` 后，推送相同版本的 `tiny-v*` 标签：

```sh
git tag tiny-v0.1.0
git push origin tiny-v0.1.0
```

两种架构的构建和检查全部成功后，自动创建 GitHub Release，附带两个压缩包和 SHA256SUMS 文件。上游的 `v*` 标签不会触发个人浏览器发布。

本地 Linux 构建（需要 Docker）：

```sh
docker run --rm -v "$PWD:/src" -w /src alpine:3.22 sh scripts/build-linux.sh
node --test tests/personal.test.cjs
```

原生构建依赖与命令见 [README.upstream.md](README.upstream.md)。上游来源与更新流程见 [UPSTREAM.md](UPSTREAM.md)。

## 使用边界

这是终端文字浏览器，不保证任意网站兼容或完全无崩溃。静态文档、博客和文字阅读是主要用途；复杂 JavaScript 应用、视频和现代登录流程需逐站验证。图片在 tmux 等复用器中可能有限制。CI 验证离线 fixture 和图片协议输出，不等于验证所有终端或真实网站。

## 许可证

Chawan 与个人定制代码使用公共领域声明，见 [UNLICENSE](UNLICENSE)。依赖组件保留各自许可证，见 [res/license.md](res/license.md)；下载包内附带这些声明。
