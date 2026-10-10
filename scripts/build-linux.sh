#!/bin/sh
set -eu
# Native Alpine container, on either x86_64 or aarch64 GitHub runner.
apk add --no-cache nim build-base pkgconf brotli-dev brotli-static \
    libssh2-dev libssh2-static openssl-dev openssl-libs-static zlib-dev zlib-static
nim --version
# Command-line LDFLAGS override Makefile additions; include -static explicitly.
make -j2 STATIC_LINK=1 LDFLAGS='-static -lz'
sh scripts/package.sh "$(uname -m)"
