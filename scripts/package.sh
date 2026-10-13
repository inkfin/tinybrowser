#!/bin/sh
set -eu
task_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$task_root"
task_arch=${1:-$(uname -m)}
task_os=${2:-$(uname -s)}
case "$task_os" in
    Linux|linux)
        task_os=linux
        case "$task_arch" in arm64) task_arch=aarch64;; x86_64|aarch64) ;; *) echo 'Unsupported Linux architecture' >&2; exit 1;; esac
        ;;
    Darwin|darwin)
        task_os=darwin
        case "$task_arch" in aarch64) task_arch=arm64;; x86_64|arm64) ;; *) echo 'Unsupported macOS architecture' >&2; exit 1;; esac
        ;;
    *) echo 'Unsupported operating system' >&2; exit 1;;
esac
task_version=$(cat VERSION)
task_name="tinybrowser-$task_version-$task_os-$task_arch"
task_package="$task_root/dist/$task_name"
task_build=${TINYBROWSER_BUILD_DIR:-target/release}
mkdir -p "$task_package"
cp -R "$task_build/bin" "$task_build/libexec" "$task_package/"
mkdir -p "$task_package/share/tinybrowser" "$task_package/share/licenses/tinybrowser"
cp personal/config.toml personal/ui.js personal/home.html personal/help.html VERSION "$task_package/share/tinybrowser/"
for task_helper in personal/open-external personal/clipboard; do
    if test -f "$task_helper"; then
        install -m755 "$task_helper" "$task_package/share/tinybrowser/"
    fi
done
install -m755 personal/tinybrowser "$task_package/bin/tinybrowser"
cp UNLICENSE res/license.md "$task_package/share/licenses/tinybrowser/"
cp README.md UPSTREAM.md "$task_package/"
install -m755 scripts/install.sh "$task_package/install.sh"
tar -C dist -czf "dist/$task_name.tar.gz" "$task_name"
printf '%s\n' "$task_package"
