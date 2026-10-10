#!/bin/sh
set -eu
task_root=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
task_prefix=${1:-"$HOME/.local"}
# Run this from an extracted release; no sudo is needed with the default prefix.
test -x "$task_root/bin/tinybrowser" || { echo 'Run install.sh from an extracted release.' >&2; exit 1; }
mkdir -p "$task_prefix/bin" "$task_prefix/libexec" "$task_prefix/share/tinybrowser" "$task_prefix/share/licenses/tinybrowser"
cp -R "$task_root/bin/." "$task_prefix/bin/"
cp -R "$task_root/libexec/chawan" "$task_prefix/libexec/"
cp -R "$task_root/share/tinybrowser/." "$task_prefix/share/tinybrowser/"
cp -R "$task_root/share/licenses/tinybrowser/." "$task_prefix/share/licenses/tinybrowser/"
printf 'Installed to %s/bin/tinybrowser\nAdd %s/bin to PATH if needed.\n' "$task_prefix" "$task_prefix"
