#!/bin/sh
set -eu
# Install an explicitly versioned release; runtime needs no package manager.
task_version=${TINYBROWSER_VERSION:-0.2.0}
task_prefix=${TINYBROWSER_PREFIX:-"$HOME/.local"}
case "$task_prefix" in /*) ;; *) task_prefix="$(pwd)/$task_prefix";; esac
case "$task_version" in ''|*[!0-9.]*|.*|*..*|*.) echo 'Invalid release version' >&2; exit 1;; esac
task_arch=$(uname -m)
case "$(uname -s)" in
    Linux)
        task_os=linux
        case "$task_arch" in arm64|aarch64) task_arch=aarch64;; x86_64) ;; *) echo 'Unsupported Linux architecture' >&2; exit 1;; esac
        ;;
    Darwin)
        task_os=darwin
        case "$task_arch" in arm64|aarch64) task_arch=arm64;; x86_64) ;; *) echo 'Unsupported Mac architecture' >&2; exit 1;; esac
        task_macos=$(sw_vers -productVersion)
        test "${task_macos%%.*}" -ge 15 || { echo 'This release requires macOS 15 or newer.' >&2; exit 1; }
        ;;
    *) echo 'Supported systems: Linux and macOS.' >&2; exit 1;;
esac
for task_tool in curl tar; do
    command -v "$task_tool" >/dev/null 2>&1 || { echo "Missing command: $task_tool" >&2; exit 1; }
done
if command -v sha256sum >/dev/null 2>&1; then
    task_sha=sha256sum
elif command -v shasum >/dev/null 2>&1; then
    task_sha=shasum
else
    echo 'A SHA256 verifier (sha256sum or shasum) is required.' >&2
    exit 1
fi
task_tmp=$(mktemp -d "${TMPDIR:-/tmp}/tinybrowser-install.XXXXXX")
trap 'rm -rf "$task_tmp"' 0
trap 'exit 1' HUP INT TERM
cd "$task_tmp"
task_name="tinybrowser-$task_version-$task_os-$task_arch"
task_base="https://github.com/inkfin/tinybrowser/releases/download/tiny-v$task_version"
curl -fL --retry 2 "$task_base/$task_name.tar.gz" -o "$task_name.tar.gz"
curl -fL --retry 2 "$task_base/SHA256SUMS-$task_os-$task_arch" -o SHA256SUMS
if [ "$task_sha" = sha256sum ]; then sha256sum -c SHA256SUMS; else shasum -a 256 -c SHA256SUMS; fi
tar -xzf "$task_name.tar.gz"
sh "$task_name/install.sh" "$task_prefix"
