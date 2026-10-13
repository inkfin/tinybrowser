#!/bin/sh
set -eu

test "$(uname -s)" = Darwin || { echo 'This build requires macOS.' >&2; exit 1; }
task_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$task_root"
# Homebrew supplies build dependencies only. The downloadable package links
# these archives into the HTTPS adapter and needs no Homebrew installation.
task_ssl=$(brew --prefix openssl)
task_ssh=$(brew --prefix libssh2)
task_brotli=$(brew --prefix brotli)
task_libs="$task_ssh/lib/libssh2.a $task_ssl/lib/libssl.a $task_ssl/lib/libcrypto.a $task_brotli/lib/libbrotlidec.a $task_brotli/lib/libbrotlicommon.a"
task_target=${TINYBROWSER_MACOS_TARGET:-15.0}
for task_lib in $task_libs; do
    test -f "$task_lib" || { echo "Missing static build dependency: $task_lib" >&2; exit 1; }
    # A lower compiler target cannot make newer prebuilt archives compatible.
    # Local developers can select a newer target; release CI uses macOS 15.
    otool -l "$task_lib" | awk -v target="$task_target" -v archive="$task_lib" '
      BEGIN { split(target, wanted, ".") }
      $1 == "minos" {
        split($2, actual, ".")
        if (actual[1] > wanted[1] || (actual[1] == wanted[1] && actual[2] > wanted[2])) {
          if (!failed) print archive " requires macOS " $2 ", above target " target > "/dev/stderr"
          failed = 1
        }
      }
      END { exit failed }
    '
done
task_nim=${NIM:-nim}
task_make=${MAKE:-make}
task_out=${TINYBROWSER_OUTDIR:-target}
task_obj=${TINYBROWSER_OBJDIR:-.obj}
# The shipped dependencies are built for current Homebrew-supported macOS.
# Do not advertise an older deployment target than their object files support.
export MACOSX_DEPLOYMENT_TARGET="$task_target"
export PKG_CONFIG_PATH="$task_ssl/lib/pkgconfig:$task_ssh/lib/pkgconfig:$task_brotli/lib/pkgconfig"
"$task_nim" --version
"$task_make" -j2 OUTDIR="$task_out" OBJDIR="$task_obj" \
    NIMC="$task_nim c --nimcache:$task_obj/bootstrap --cc:clang --clang.exe:/usr/bin/clang --clang.linkerexe:/usr/bin/clang" \
    CC=/usr/bin/clang CFLAGS="-mmacosx-version-min=$task_target" LDFLAGS="-mmacosx-version-min=$task_target" \
    ssl_cflags="-I$task_ssl/include -I$task_ssh/include -I$task_brotli/include" \
    ssl_ldflags="$task_libs -lz"
TINYBROWSER_BUILD_DIR="$task_out/release" sh scripts/package.sh "$(uname -m)" darwin
