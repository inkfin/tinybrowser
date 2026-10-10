"""Exercise the released binary in a PTY, including native menus and images."""
import fcntl
import os
from pathlib import Path
import pty
import select
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import time
import zlib

import pyte  # CI-only; never included in downloads.

package = Path(sys.argv[1]).resolve()
screens = Path('work/screens')
screens.mkdir(parents=True, exist_ok=True)
fixture = Path('tests/fixtures/reading.html').resolve()
def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))

# A real, visible PNG. No imaging dependency is needed for this fixture.
Path('tests/fixtures/pixel.png').write_bytes(
    b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 32, 16, 8, 2, 0, 0, 0)) +
    chunk(b'IDAT', zlib.compress((b'\x00' + b'\x22\xaa\xdd' * 32) * 16)) + chunk(b'IEND', b''))

with tempfile.TemporaryDirectory(prefix='tinybrowser-smoke-') as state:
    env = dict(os.environ, TINYBROWSER_CONFIG_DIR=state + '/config',
               TINYBROWSER_DATA_DIR=state + '/data', TERM='xterm-256color')
    binary = str(package / 'bin/tinybrowser')
    dump = subprocess.run([binary, '-d', str(fixture)], env=env, capture_output=True, text=True, timeout=20)
    assert dump.returncode == 0, dump.stderr
    assert '你好' in dump.stdout and 'Alpha' in dump.stdout and '42' in dump.stdout, dump.stdout
    assert 'READER_VISIBLE' in dump.stdout, dump.stdout
    assert 'UNEXPECTED_SCRIPT_EXECUTION' not in dump.stdout
    assert 'Error' not in dump.stderr and 'Exception' not in dump.stderr, dump.stderr
    (screens / 'reading-dump.txt').write_text(dump.stdout)

    if os.environ.get('TINYBROWSER_TEST_HTTPS') == '1':
        online = subprocess.run([binary, '-d', 'https://chawan.net/'], env=env,
                                capture_output=True, text=True, timeout=30)
        assert online.returncode == 0 and 'Chawan: TUI web browser' in online.stdout, online.stderr + online.stdout
        (screens / 'live-chawan.txt').write_text(online.stdout)

    # Install to a path with spaces; preserve an existing personal config.
    prefix = Path(state) / 'prefix with spaces'
    subprocess.run([str(package / 'install.sh'), str(prefix)], check=True, capture_output=True)
    config = Path(env['TINYBROWSER_CONFIG_DIR']) / 'config.toml'
    config.write_text(config.read_text() + '\n# keep my personal edits\n')
    subprocess.run([str(prefix / 'bin/tinybrowser'), '--version'], env=env, check=True, capture_output=True)
    assert '# keep my personal edits' in config.read_text()

    def session(cols, rows, image=False):
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, rows * 18, cols * 9))
        args = [binary, '-o', 'display.alt-screen=false', '-o', 'display.set-title=false']
        args += ['-o', 'display.image-mode=' + ('kitty' if image else 'none')]
        args += [str(fixture)]
        proc = subprocess.Popen(args, stdin=slave, stdout=slave, stderr=slave, env=env, start_new_session=True)
        os.close(slave)
        screen = pyte.Screen(cols, rows)
        stream = pyte.ByteStream(screen)
        raw = bytearray()

        def drain(duration=0.5):
            end = time.monotonic() + duration
            while time.monotonic() < end:
                if select.select([master], [], [], 0.05)[0]:
                    try:
                        data = os.read(master, 65536)
                    except OSError:
                        break
                    raw.extend(data)
                    # Answer terminal device/size queries, as a real terminal would.
                    if b'\x1b[c' in data or b'\x1b[0c' in data:
                        os.write(master, b'\x1b[?1;2c')
                    if b'\x1b[14t' in data:
                        os.write(master, f'\x1b[4;{rows*18};{cols*9}t'.encode())
                    if b'\x1b[16t' in data:
                        os.write(master, b'\x1b[6;18;9t')
                    if b'\x1b[6n' in data:
                        os.write(master, f'\x1b[{rows};{cols}R'.encode())
                    stream.feed(data)
            assert proc.poll() is None, bytes(raw).decode(errors='replace')

        def send(keys):
            os.write(master, keys.encode())
            drain()

        def view(name):
            text = '\n'.join(screen.display)
            (screens / f'{cols}-{name}.txt').write_text(text)
            return text

        try:
            drain(3)
            if image:
                assert b',a=T,f=100,' in raw, 'No decoded PNG sent through Kitty image protocol'
                (screens / 'image-protocol.txt').write_text('PNG decoded and Kitty image output emitted.\n')
                return
            assert 'Reading fixture' in view('reading')
            send(' ')
            assert 'Open URL / search' in view('menu'), view('menu-error')
            # j/k must move inside the popup and Enter must execute the selection.
            send('j'); send('k'); send('\r')
            assert 'URL' in view('open-url'), view('open-url-error')
            send('\x1b')
            assert 'URL:' not in view('cancel-url')
            send(' '); send('\x1b')
            assert 'Open URL / search' not in view('cancel')
            send(':'); send('help\r')
            drain(1)
            assert 'Keys & commands' in view('help')
            send('H'); drain(1)
            assert 'READER_VISIBLE' in view('back')
            send('gr'); drain(1)
            assert 'READER_VISIBLE' not in view('website-css')
            send('gr'); drain(1)
            assert 'READER_VISIBLE' in view('reader-css')
            send('\x10'); send('images\r')
            assert 'Toggle images' in view('finder')
            send('\x1b')
            assert 'Toggle images' not in view('cancel-finder')
            os.write(master, b'q')
            deadline = time.monotonic() + 10
            while proc.poll() is None and time.monotonic() < deadline:
                if select.select([master], [], [], 0.05)[0]:
                    try:
                        data = os.read(master, 65536)
                    except OSError:
                        break
                    raw.extend(data)
                    stream.feed(data)
            view('quit')
            proc.wait(timeout=1)
            assert proc.returncode == 0
        finally:
            (screens / f'{cols}-raw.ansi').write_bytes(raw)
            if proc.poll() is None:
                os.killpg(proc.pid, signal.SIGTERM)
                proc.wait(timeout=5)
            os.close(master)

    session(100, 32)
    session(45, 20)
    session(100, 32, image=True)
print('Packaged browser: reading, native menu, command bar, finder, CSS toggle, install, images passed.')
