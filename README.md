# Tinybrowser

基于 [Chawan](https://chawan.net/) 的个人终端浏览器。保留上游 Git 历史，用一个小配置层提供 Vim 操作、原生弹出菜单、快捷命令和文字阅读排版。

浏览器不依赖 Chromium、WebKit、Electron、Node.js、Python 或 fzf。Node/Python 仅用于开发和 CI 检查。

## Linux / macOS 安装

支持 Linux x86_64 / ARM64，以及 macOS 15+ 的 Intel / Apple Silicon。
发布包不需要 Homebrew、Nim 或其他开发工具；macOS 包将第三方库静态链接，只使用系统动态库。

一键安装到 `~/.local`，自动识别系统与架构、校验 SHA256，保留已有用户配置和浏览数据：

```sh
curl -fsSL https://raw.githubusercontent.com/inkfin/tinybrowser/tiny-v0.2.0/scripts/get.sh | sh
~/.local/bin/tinybrowser
```

也可以先下载并查看 `scripts/get.sh` 再执行。设置 `TINYBROWSER_PREFIX` 可改变安装位置。
手动下载见 [Releases](https://github.com/inkfin/tinybrowser/releases/latest)：

| 平台 | 下载文件 | 校验文件 |
| --- | --- | --- |
| Linux Intel/AMD | `tinybrowser-0.2.0-linux-x86_64.tar.gz` | `SHA256SUMS-linux-x86_64` |
| Linux ARM64 | `tinybrowser-0.2.0-linux-aarch64.tar.gz` | `SHA256SUMS-linux-aarch64` |
| macOS Apple Silicon | `tinybrowser-0.2.0-darwin-arm64.tar.gz` | `SHA256SUMS-darwin-arm64` |
| macOS Intel | `tinybrowser-0.2.0-darwin-x86_64.tar.gz` | `SHA256SUMS-darwin-x86_64` |

Linux 用 `sha256sum -c SHA256SUMS-linux-x86_64`，macOS 用 `shasum -a 256 -c SHA256SUMS-darwin-arm64`，按实际架构替换名称。解压后运行 `./bin/tinybrowser`，或用 `./install.sh` 安装。

Linux 使用 musl 静态构建，HTTPS 需要发行版的 `ca-certificates`。macOS 默认使用 `/etc/ssl/cert.pem`，尊重用户显式设置的 `SSL_CERT_FILE` / `SSL_CERT_DIR`。图片需要支持 Kitty 图形协议或 Sixel 的终端；纯文字终端仍可阅读。

## X 和复杂网页

`:x` 在系统默认浏览器打开 X；登录、关注流和互动由系统浏览器处理。
`gx` / `:external` 打开当前网页，右键链接可选择在系统浏览器打开。
这是明确的外部浏览器交接，Tinybrowser 本身没有实现 X 登录或时间线。

现有 Chawan 运行 X 登录页会遇到缺少网页 API 的错误。网站 JS 默认关闭，按页面开启也不代表任意 Web 应用兼容。
开发文档和静态论坛阅读仍是 Tinybrowser 的主要用途。

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
| `o/O`、`r` | 打开/编辑地址或搜索、保留 JS/Cookie/CSS 设置刷新 |
| `gx`、`:x` | 系统浏览器打开当前网页 / X |
| `yy/yl`、`b/a` | 复制页面/链接 URL、书签/添加书签 |
| `gi/gr` | 切换图片 / 当前页面的网站 CSS，保留阅读位置 |
| `gh`、`F1`、`q` | 主页、帮助、退出 |

命令栏支持 `open/o`、`search/s`、`tabopen/t`、`buffers`、`bookmarks`、`bookmark`、`history`、`reload`、`images`、`style`、`javascript`、`cookies`、`copy`、`external`、`external-link`、`x`、`save`、`source`、`home`、`help`、`quit/q`。
输入按固定命令分派，不会当作 JavaScript 或 shell 执行。`:cookies` 切换当前页是否启用 Cookie；刷新保留当前页的 Cookie、JS 和样式设置。这些开关不是跨站永久规则，Cookie 的保存策略仍由用户配置决定。

鼠标单击打开链接，中键链接在后台新标签打开，`gt` 切换过去；拖动选择文字，右键复制选区。空格和右键共用动作表，右键额外提供链接、图片和选区操作。点击底部状态栏可以编辑地址。完整帮助在 F1 中查看。

## 默认行为与自定义

图片默认开启；网站 JavaScript 和 Cookie 默认关闭。个人菜单脚本独立于网站 JavaScript，不需要开启网页脚本才能操作。`:javascript` 只切换当前页面。默认关闭网站 CSS，应用 88 列正文宽度、中文/代码块/表格阅读样式；`gr` 切换网站 CSS，不隐藏网站正文。

`gi` 临时切换当前页图片，刷新或重新加载后恢复配置默认值；要持续禁用图片，请修改 `[buffer] images`。

首次启动将默认配置复制到 `~/.config/tinybrowser/config.toml`。后续更新保留你的修改。历史、书签等保存在 `~/.local/share/tinybrowser/`。升级保留旧配置，因此旧配置不会自动获得新增快捷键；`:x`、`:external` 和菜单仍可使用，新默认键位可参考包内 `share/tinybrowser/config.toml`。支持 XDG 路径，以及 `TINYBROWSER_CONFIG_DIR` / `TINYBROWSER_DATA_DIR` 指定独立配置。

主要修改入口：

- `personal/config.toml`：默认快捷键、排版、逐站策略。
- `personal/ui.js`：菜单与命令注册；运行时文件在 `share/tinybrowser/`。
- `personal/home.html` / `help.html`：主页和帮助。
- `src/`：只有需要扩展引擎时才修改。

当前版本先完成个人浏览器基础功能，没有嵌入 AI 模型或自动把网页发送给 AI。可让编码助手修改这个仓库；未来按键调用 AI 可接成按需运行的外部工具。

## 构建与发布

每次 main 推送或 PR 在四个原生 runner 上构建：Linux x86_64 / ARM64 和 Darwin Intel / Apple Silicon。
Linux 在 Alpine 中静态构建；macOS 使用静态第三方库，并检查依赖最低系统版本、目标架构和系统动态库路径。
CI 解压实际下载包后运行命令逻辑、安装、真实 PTY 键盘/鼠标、阅读状态、图片协议与 HTTPS 检查。

更新 `VERSION` 和 `docs/release-notes.md`，先等待 main 的四项 CI 全部通过，再推送匹配的 `tiny-v*` 标签。
标签流水线重新验证，全部成功后创建 GitHub Release，附带四个压缩包和各自的 SHA256SUMS。上游 `v*` 标签不会触发发布。

```sh
# 本地 Linux，需 Docker
docker run --rm -v "$PWD:/src" -w /src alpine:3.22 sh scripts/build-linux.sh
# 本地 macOS，需 Nim、make、pkg-config 及 OpenSSL/libssh2/brotli 开发库
sh scripts/build-macos.sh
node --test tests/*.test.cjs
```

较新 Homebrew 构建的静态库可能要求高于 macOS 15 的版本。本地可用 `TINYBROWSER_MACOS_TARGET` 明确提高目标，但这样的产物不能标成兼容 macOS 15；正式包只来自指定 CI runner。

上游来源与修改范围见 [UPSTREAM.md](UPSTREAM.md)，验证记录见 [docs/validation.md](docs/validation.md)。

## 使用边界

这是终端文字浏览器，不保证任意网站兼容或完全无崩溃。静态文档、博客和文字阅读是主要用途；复杂 JavaScript 应用、视频和现代登录流程需逐站验证。图片在 tmux 等复用器中可能有限制。CI 验证离线 fixture 和图片协议输出，不等于验证所有终端或真实网站。

## 许可证

Chawan 与个人定制代码使用公共领域声明，见 [UNLICENSE](UNLICENSE)。依赖组件保留各自许可证，见 [res/license.md](res/license.md)；下载包内附带这些声明。
