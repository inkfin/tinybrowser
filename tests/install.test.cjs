const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawn, spawnSync} = require('node:child_process');
const {once} = require('node:events');

const installer = path.resolve(__dirname, '../scripts/get.sh');
const releaseInstaller = path.resolve(__dirname, '../scripts/install.sh');

function findTool(name) {
    const result = spawnSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', name], {encoding: 'utf8'});
    return result.status === 0 ? result.stdout.trim() : null;
}

function installFixture(t, options = {}) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tinybrowser-installer-test-')));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    for (const dir of ['bin', 'home', 'tmp', 'remote', 'fixture']) fs.mkdirSync(path.join(root, dir));
    const bin = path.join(root, 'bin');
    const sha = options.sha || (findTool('sha256sum') ? 'sha256sum' : 'shasum');
    // A closed PATH makes an accidental real curl invocation impossible.
    for (const tool of ['sh', 'tar', 'gzip', 'mktemp', 'rm', 'cp', sha]) {
        const executable = findTool(tool);
        assert.ok(executable, `Required test tool: ${tool}`);
        fs.symlinkSync(executable, path.join(bin, tool));
    }
    const writeCommand = (name, body) => fs.writeFileSync(path.join(bin, name), `#!/bin/sh\nset -eu\n${body}\n`, {mode: 0o755});
    writeCommand('uname', 'case "$1" in -s) printf "%s\\n" "$TB_TEST_OS";; -m) printf "%s\\n" "$TB_TEST_ARCH";; *) exit 1;; esac');
    writeCommand('sw_vers', 'test "$1" = -productVersion\nprintf "%s\\n" "$TB_TEST_MACOS"');
    writeCommand('curl', `
url= destination=
while [ "$#" -gt 0 ]; do
    case "$1" in
        https://*) url=$1;;
        -o) shift; destination=$1;;
    esac
    shift
done
test -n "$url" && test -n "$destination"
printf '%s\\n' "$url" >> "$TB_TEST_DOWNLOAD_LOG"
cp "$TB_TEST_REMOTE/\${url##*/}" "$destination"`);

    const version = options.version || '0.2.0';
    const platform = options.platform || 'linux';
    const arch = options.packageArch || 'x86_64';
    const name = `tinybrowser-${version}-${platform}-${arch}`;
    const packageDir = path.join(root, 'fixture', name);
    fs.mkdirSync(packageDir);
    // The release fixture records the prefix without modifying the destination.
    fs.writeFileSync(path.join(packageDir, 'install.sh'), '#!/bin/sh\nset -eu\nprintf "%s" "$1" > "$TB_TEST_INSTALL_LOG"\n', {mode: 0o755});
    const archiveName = `${name}.tar.gz`;
    const archive = path.join(root, 'remote', archiveName);
    const packed = spawnSync(findTool('tar'), ['-czf', archive, '-C', path.join(root, 'fixture'), name], {encoding: 'utf8'});
    assert.equal(packed.status, 0, packed.stderr);
    const hash = options.corrupt ? '0'.repeat(64) : createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    const checksumName = `SHA256SUMS-${platform}-${arch}`;
    fs.writeFileSync(path.join(root, 'remote', checksumName), `${hash}  ${archiveName}\n`);
    const installLog = path.join(root, 'installed-prefix');
    const downloadLog = path.join(root, 'downloaded-urls');
    const env = {
        ...process.env,
        PATH: bin,
        HOME: path.join(root, 'home'),
        TMPDIR: path.join(root, 'tmp'),
        TINYBROWSER_VERSION: options.requestVersion ?? version,
        TINYBROWSER_PREFIX: options.prefix ?? path.join(root, 'prefix with spaces'),
        TB_TEST_OS: options.os || 'Linux',
        TB_TEST_ARCH: options.arch || 'x86_64',
        TB_TEST_MACOS: options.macos || '15.0',
        TB_TEST_REMOTE: path.join(root, 'remote'),
        TB_TEST_DOWNLOAD_LOG: downloadLog,
        TB_TEST_INSTALL_LOG: installLog,
    };
    if (options.defaultPrefix) delete env.TINYBROWSER_PREFIX;
    const result = spawnSync('/bin/sh', [installer], {cwd: root, env, encoding: 'utf8', timeout: 15000});
    assert.ifError(result.error);
    return {
        ...result,
        root,
        prefix: fs.existsSync(installLog) ? fs.readFileSync(installLog, 'utf8') : null,
        downloads: fs.existsSync(downloadLog) ? fs.readFileSync(downloadLog, 'utf8').trim().split('\n') : [],
        expectedDownloads: [archiveName, checksumName].map(file => `https://github.com/inkfin/tinybrowser/releases/download/tiny-v${version}/${file}`),
        tempFiles: fs.readdirSync(path.join(root, 'tmp')),
    };
}

for (const variant of [
    {label: 'Linux x86_64', os: 'Linux', arch: 'x86_64', platform: 'linux', packageArch: 'x86_64'},
    {label: 'Linux aarch64', os: 'Linux', arch: 'aarch64', platform: 'linux', packageArch: 'aarch64'},
    {label: 'Linux arm64 alias', os: 'Linux', arch: 'arm64', platform: 'linux', packageArch: 'aarch64'},
    {label: 'macOS arm64', os: 'Darwin', arch: 'arm64', platform: 'darwin', packageArch: 'arm64'},
    {label: 'macOS x86_64', os: 'Darwin', arch: 'x86_64', platform: 'darwin', packageArch: 'x86_64'},
    {label: 'macOS aarch64 alias', os: 'Darwin', arch: 'aarch64', platform: 'darwin', packageArch: 'arm64'},
]) {
    test(`installs the verified ${variant.label} release into a prefix with spaces`, t => {
        const result = installFixture(t, variant);
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(result.downloads, result.expectedDownloads);
        assert.equal(result.prefix, path.join(result.root, 'prefix with spaces'));
        assert.deepEqual(result.tempFiles, [], 'Temporary download directory is removed');
    });
}

function upgradeFixture(t) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tinybrowser-upgrade-test-')));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const packageDir = path.join(root, 'new package');
    const prefix = path.join(root, 'installed prefix');
    const home = path.join(root, 'home');
    for (const dir of ['bin', 'libexec/chawan', 'share/tinybrowser', 'share/licenses/tinybrowser']) {
        fs.mkdirSync(path.join(packageDir, dir), {recursive: true});
        fs.mkdirSync(path.join(prefix, dir), {recursive: true});
    }
    fs.mkdirSync(path.join(home, '.config/tinybrowser'), {recursive: true});
    fs.mkdirSync(path.join(home, '.local/share/tinybrowser'), {recursive: true});
    fs.writeFileSync(path.join(home, '.config/tinybrowser/config.toml'), '# personal config\n');
    fs.writeFileSync(path.join(home, '.local/share/tinybrowser/history'), 'personal history\n');
    fs.copyFileSync(releaseInstaller, path.join(packageDir, 'install.sh'));
    fs.writeFileSync(path.join(packageDir, 'bin/tinybrowser'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
    fs.writeFileSync(path.join(packageDir, 'bin/cha'), '#!/bin/sh\nprintf "%s\\n" "$1"\n', {mode: 0o755});
    fs.writeFileSync(path.join(prefix, 'bin/cha'), '#!/bin/sh\nprintf "old version\\n"\n', {mode: 0o755});
    fs.writeFileSync(path.join(packageDir, 'libexec/chawan/ssl'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
    fs.symlinkSync('ssl', path.join(packageDir, 'libexec/chawan/http'));
    fs.writeFileSync(path.join(packageDir, 'share/tinybrowser/config.toml'), '# new defaults\n');
    fs.writeFileSync(path.join(packageDir, 'share/licenses/tinybrowser/UNLICENSE'), 'fixture notice\n');
    return {root, packageDir, prefix, home, env: {...process.env, HOME: home}};
}

test('replaces an executable while its old process keeps running and preserves user data', {timeout: 15000}, async t => {
    const fixture = upgradeFixture(t);
    const executable = path.join(fixture.prefix, 'bin/cha');
    // A real native process catches Linux ETXTBSY; a shell script alone would
    // not. Build our own fixture because copied Apple system binaries can be
    // rejected by macOS signature checks before the installer even runs.
    const compiler = findTool('cc');
    assert.ok(compiler, 'The native upgrade test needs the system C compiler');
    const compiled = spawnSync(compiler, ['-x', 'c', '-o', executable, '-'], {
        input: '#include <stdio.h>\n#include <unistd.h>\nint main(void) { puts("ready"); fflush(stdout); sleep(30); return 0; }\n',
        encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(compiled.error);
    assert.equal(compiled.status, 0, compiled.stderr);
    const oldProcess = spawn(executable, [], {stdio: ['ignore', 'pipe', 'pipe']});
    const ready = new Promise((resolve, reject) => {
        oldProcess.stdout.once('data', data => {
            if (data.toString().includes('ready')) resolve();
            else reject(new Error('Native upgrade fixture did not signal readiness'));
        });
        oldProcess.once('error', reject);
        oldProcess.once('exit', (code, signal) => reject(new Error(`Native fixture exited before readiness: ${code} ${signal}`)));
    });
    try {
        await ready;
        const installed = spawnSync('/bin/sh', [path.join(fixture.packageDir, 'install.sh'), fixture.prefix], {
            env: fixture.env, encoding: 'utf8', timeout: 10000,
        });
        assert.ifError(installed.error);
        assert.equal(installed.status, 0, installed.stderr);
        process.kill(oldProcess.pid, 0); // The original native executable is still running.
        const updated = spawnSync(executable, ['new-version'], {encoding: 'utf8'});
        assert.equal(updated.status, 0, `Installed executable failed: ${updated.signal} ${updated.stderr}`);
        assert.equal(updated.stdout.trim(), 'new-version');
        assert.equal(fs.readlinkSync(path.join(fixture.prefix, 'libexec/chawan/http')), 'ssl');
        assert.ok(fs.statSync(path.join(fixture.prefix, 'libexec/chawan/ssl')).mode & 0o111);
        assert.equal(fs.readFileSync(path.join(fixture.home, '.config/tinybrowser/config.toml'), 'utf8'), '# personal config\n');
        assert.equal(fs.readFileSync(path.join(fixture.home, '.local/share/tinybrowser/history'), 'utf8'), 'personal history\n');
    } finally {
        if (oldProcess.exitCode === null && oldProcess.signalCode === null) {
            const exited = once(oldProcess, 'exit');
            oldProcess.kill('SIGTERM');
            await exited;
        }
    }
});

test('a partial copy failure keeps the old destination file intact and removes its temporary file', t => {
    const fixture = upgradeFixture(t);
    const executable = path.join(fixture.prefix, 'bin/cha');
    const previous = fs.readFileSync(executable);
    const stubDir = path.join(fixture.root, 'fault-tools');
    fs.mkdirSync(stubDir);
    fs.writeFileSync(path.join(stubDir, 'cp'), `#!/bin/sh
set -eu
fail= destination=
for argument do
    if [ "$argument" = "$TB_TEST_FAIL_SOURCE" ]; then fail=1; fi
    destination=$argument
done
if [ "$fail" = 1 ]; then
    printf 'partial file' > "$destination"
    exit 1
fi
exec "$TB_TEST_REAL_CP" "$@"
`, {mode: 0o755});
    const installed = spawnSync('/bin/sh', [path.join(fixture.packageDir, 'install.sh'), fixture.prefix], {
        env: {...fixture.env, PATH: `${stubDir}${path.delimiter}${process.env.PATH}`,
            TB_TEST_FAIL_SOURCE: path.join(fixture.packageDir, 'bin/cha'), TB_TEST_REAL_CP: findTool('cp')},
        encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(installed.error);
    assert.notEqual(installed.status, 0);
    assert.deepEqual(fs.readFileSync(executable), previous);
    assert.deepEqual(fs.readdirSync(path.dirname(executable)).filter(name => name.startsWith('.tinybrowser-file.')), []);
});

test('supports shasum-only hosts and an explicitly selected release', t => {
    if (!findTool('shasum')) return t.skip('shasum is unavailable on this host');
    const result = installFixture(t, {sha: 'shasum', version: '0.2.7'});
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.downloads, result.expectedDownloads);
    assert.ok(result.prefix);
});

test('uses the isolated home directory for the default installation prefix', t => {
    const result = installFixture(t, {defaultPrefix: true});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.prefix, path.join(result.root, 'home', '.local'));
});

test('resolves a relative prefix before moving into its temporary directory', t => {
    const result = installFixture(t, {prefix: 'relative prefix with spaces'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.prefix, path.join(result.root, 'relative prefix with spaces'));
});

test('a corrupt download cannot run the release installer', t => {
    const result = installFixture(t, {corrupt: true});
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.downloads, result.expectedDownloads);
    assert.equal(result.prefix, null);
    assert.deepEqual(result.tempFiles, [], 'Failed downloads are removed');
});

for (const variant of [
    {label: 'unsupported operating system', os: 'Windows_NT'},
    {label: 'unsupported Linux architecture', arch: 'riscv64'},
    {label: 'unsupported macOS architecture', os: 'Darwin', arch: 'i686'},
    {label: 'macOS older than 15', os: 'Darwin', arch: 'arm64', macos: '14.8'},
    {label: 'invalid release version', requestVersion: '../0.2.0'},
]) {
    test(`rejects ${variant.label} before downloading`, t => {
        const result = installFixture(t, variant);
        assert.notEqual(result.status, 0);
        assert.deepEqual(result.downloads, []);
        assert.equal(result.prefix, null);
        assert.deepEqual(result.tempFiles, []);
    });
}
