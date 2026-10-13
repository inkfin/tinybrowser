#!/bin/sh
set -eu
task_root=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
task_prefix=${1:-"$HOME/.local"}
# Run this from an extracted release; no sudo is needed with the default prefix.
test -x "$task_root/bin/tinybrowser" || { echo 'Run install.sh from an extracted release.' >&2; exit 1; }
# Each file is copied completely, then renamed on the destination filesystem.
# Running executables retain their old inode; failed copies retain the old file.
# This protects individual files, not an entire release as one transaction.
task_install_tree() (
    task_source=$1
    task_destination=$2
    task_temporary=
    trap 'if [ -n "$task_temporary" ]; then rm -f "$task_temporary"; fi' 0
    trap 'exit 1' HUP INT TERM
    test -d "$task_source" || { echo "Missing package directory: $task_source" >&2; exit 1; }
    mkdir -p "$task_destination"
    for task_entry in "$task_source"/* "$task_source"/.[!.]* "$task_source"/..?*; do
        if [ ! -e "$task_entry" ] && [ ! -L "$task_entry" ]; then continue; fi
        task_name=${task_entry##*/}
        if [ -d "$task_entry" ] && [ ! -L "$task_entry" ]; then
            task_install_tree "$task_entry" "$task_destination/$task_name"
        else
            if [ -d "$task_destination/$task_name" ]; then
                echo "Cannot replace a directory with a package file: $task_destination/$task_name" >&2
                exit 1
            fi
            task_temporary=$(mktemp "$task_destination/.tinybrowser-file.XXXXXX")
            cp -pP "$task_entry" "$task_temporary"
            mv -f "$task_temporary" "$task_destination/$task_name"
            task_temporary=
        fi
    done
)
task_install_tree "$task_root/bin" "$task_prefix/bin"
task_install_tree "$task_root/libexec/chawan" "$task_prefix/libexec/chawan"
task_install_tree "$task_root/share/tinybrowser" "$task_prefix/share/tinybrowser"
task_install_tree "$task_root/share/licenses/tinybrowser" "$task_prefix/share/licenses/tinybrowser"
printf 'Installed to %s/bin/tinybrowser\nAdd %s/bin to PATH if needed.\n' "$task_prefix" "$task_prefix"
