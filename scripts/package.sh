#!/bin/sh
set -eu
task_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$task_root"
task_arch=${1:-$(uname -m)}
case "$task_arch" in x86_64|aarch64) ;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
task_version=$(cat VERSION)
task_name="tinybrowser-$task_version-linux-$task_arch"
task_package="$task_root/dist/$task_name"
mkdir -p "$task_package"
cp -R target/release/bin target/release/libexec "$task_package/"
mkdir -p "$task_package/share/tinybrowser" "$task_package/share/licenses/tinybrowser"
cp personal/config.toml personal/ui.js personal/home.html personal/help.html VERSION "$task_package/share/tinybrowser/"
install -m755 personal/tinybrowser "$task_package/bin/tinybrowser"
cp UNLICENSE res/license.md "$task_package/share/licenses/tinybrowser/"
cp README.md UPSTREAM.md "$task_package/"
install -m755 scripts/install.sh "$task_package/install.sh"
tar -C dist -czf "dist/$task_name.tar.gz" "$task_name"
printf '%s\n' "$task_package"
