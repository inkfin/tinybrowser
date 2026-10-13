"""Exercise the released binary in a PTY, including native menus and images."""
import fcntl
import html
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import threading
import time
import zlib

import pyte  # CI-only; never included in downloads.

package = Path(sys.argv[1]).resolve()
screens = Path('work/screens')
screens.mkdir(parents=True, exist_ok=True)
fixture = Path('tests/fixtures/reading.html').resolve()
def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))


@contextmanager
def redirect_fixture():
    """Use real loopback HTTP responses so redirect callbacks run asynchronously."""
    final_received = threading.Event()
    form_submitted = threading.Event()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            if self.path in ('/redirect', '/hop'):
                # Ensure the background-tab action has returned before redirecting.
                time.sleep(0.15)
                self.send_response(302)
                self.send_header('Location', '/hop' if self.path == '/redirect' else '/final')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            if self.path == '/source':
                body = ('<!doctype html><title>Redirect source</title>'
                        '<h1>ORIGINAL_CONTENT_MARKER</h1>'
                        '<p><a href="/redirect">Follow redirect</a></p>'
                        '<form action="/submitted"><p><input name="q" value="INPUT_FIELD_MARKER"></p>'
                        '<p><input type="submit" value="Submit marker"></p></form>')
            elif self.path == '/final':
                body = ('<!doctype html><title>Redirect final</title>'
                        '<h1>REDIRECT_FINAL_CONTENT_MARKER</h1>')
            elif self.path.startswith('/submitted'):
                form_submitted.set()
                body = '<h1>FORM_SUBMITTED_UNEXPECTEDLY</h1>'
            else:
                self.send_error(404)
                return
            encoded = body.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            self.wfile.flush()
            if self.path == '/final':
                final_received.set()

    with ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}', final_received, form_submitted
        finally:
            server.shutdown()
            worker.join(timeout=2)


# A real, visible PNG. No imaging dependency is needed for this fixture.
Path('tests/fixtures/pixel.png').write_bytes(
    b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 32, 16, 8, 2, 0, 0, 0)) +
    chunk(b'IDAT', zlib.compress((b'\x00' + b'\x22\xaa\xdd' * 32) * 16)) + chunk(b'IEND', b''))

with tempfile.TemporaryDirectory(prefix='tinybrowser-smoke-') as state:
    state_path = Path(state)
    helpers = state_path / 'helpers'
    helpers.mkdir()
    clipboard = state_path / 'clipboard.txt'
    opened = state_path / 'opened-args'
    open_tool = state_path / 'opened-tool'
    sentinel = state_path / 'must-not-exist'
    copy_sink = helpers / 'copy-sink'
    copy_sink.write_text('#!/bin/sh\ncat > "$TINYBROWSER_TEST_CLIPBOARD"\n')
    copy_sink.chmod(0o755)
    # Record argv without ever invoking a real GUI or writing the system clipboard.
    for name in ('open', 'xdg-open'):
        sink = helpers / name
        sink.write_text('#!/bin/sh\nprintf "%s\\0" "$@" > "$TINYBROWSER_TEST_OPEN_RESULT"\n'
                        'printf "%s" "$0" > "$TINYBROWSER_TEST_OPEN_TOOL"\n')
        sink.chmod(0o755)
    external_url = 'https://example.invalid/read?text=$(touch${IFS}' + str(sentinel) + ');value=two&literal=%27'
    long_fixture = state_path / 'long.html'
    long_fixture.write_text(
        '<!doctype html><meta charset="utf-8"><title>Long reading fixture</title>'
        '<style>.reader-only { display: none }</style>'
        '<h1>Long reading fixture</h1><p class="reader-only">READER_ONLY_MARKER</p>'
        '<p>SELECT_EXACT_alpha_beta</p>'
        '<p><a href="' + html.escape(external_url, quote=True) + '">External safe link</a></p>'
        '<pre>' + '\n'.join(f'BODY_LINE_{i:03d} stable reading position' for i in range(150)) + '</pre>')
    env = dict(os.environ, TINYBROWSER_CONFIG_DIR=state + '/config',
               TINYBROWSER_DATA_DIR=state + '/data', TERM='xterm-256color',
               PATH=str(helpers) + os.pathsep + os.environ.get('PATH', ''),
               TINYBROWSER_TEST_CLIPBOARD=str(clipboard), TINYBROWSER_TEST_OPEN_RESULT=str(opened),
               TINYBROWSER_TEST_OPEN_TOOL=str(open_tool))
    binary = str(package / 'bin/tinybrowser')
    # Exercise both platform branches of the shipped shell helper with fixed
    # executables, independently of the OS running this acceptance suite.
    uname_dir = state_path / 'helper-platform'
    uname_dir.mkdir()
    fake_uname = uname_dir / 'uname'
    fake_uname.write_text('#!/bin/sh\nprintf "%s\\n" "$TINYBROWSER_TEST_OS"\n')
    fake_uname.chmod(0o755)
    opener = str(package / 'share/tinybrowser/open-external')
    helper_env = dict(env, PATH=str(uname_dir) + os.pathsep + env['PATH'],
                      TINYBROWSER_EXTERNAL_URL=external_url)
    for platform in ('Linux', 'Darwin'):
        helper_env['TINYBROWSER_TEST_OS'] = platform
        result = subprocess.run([opener], env=helper_env, capture_output=True, timeout=5)
        assert result.returncode == 0, (platform, result.stderr)
        assert opened.read_bytes() == external_url.encode() + b'\0'
        assert Path(open_tool.read_text()).name == ('open' if platform == 'Darwin' else 'xdg-open')
        opened.unlink()
    for invalid in ('javascript:alert(1)', 'file:///tmp/example', '--help', '', 'https://'):
        result = subprocess.run([opener], env=dict(helper_env, TINYBROWSER_EXTERNAL_URL=invalid),
                                capture_output=True, timeout=5)
        assert result.returncode != 0, invalid
        assert not opened.exists(), invalid
    assert not sentinel.exists(), 'Shell helper evaluated the URL'
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
        args += ['-o', 'input.use-mouse=true', '-o', 'input.osc52-copy=false',
                 '-o', 'input.osc52-primary=false', '-o', 'external.copy-cmd=' + json.dumps(str(copy_sink))]
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

        def locate(text):
            for y, row in enumerate(screen.display[:-1]):
                x = row.find(text)
                if x >= 0:
                    return x, y
            raise AssertionError(f'{text!r} not visible:\n' + view('missing-text'))

        def mouse(button, x, y, release=False, move=False):
            # SGR coordinates are one-based; pyte screen coordinates are zero-based.
            code = button + (32 if move else 0)
            send(f'\x1b[<{code};{x + 1};{y + 1}' + ('m' if release else 'M'))

        def click(button, x, y):
            mouse(button, x, y)
            mouse(button, x, y, release=True)

        def visible_line():
            lines = re.findall(r'BODY_LINE_(\d+)', '\n'.join(screen.display[:-1]))
            assert lines, view('missing-long-lines')
            return int(lines[0])

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

            if cols == 100:
                # A real SGR mouse click follows a link on the first click.
                send('/Second page\r')
                link_x, link_y = locate('Second page')
                click(0, link_x + 2, link_y)
                drain(1)
                assert 'Second fixture' in view('mouse-follow')
                send('H'); drain(1)
                assert 'Reading fixture' in view('mouse-back')
                send('/Second page\r')
                link_x, link_y = locate('Second page')
                click(1, link_x + 2, link_y)
                drain(1)
                assert 'Reading fixture' in view('mouse-background-tab')
                send('gt'); drain(1)
                assert 'Second fixture' in view('mouse-tab-switch')
                send('gT'); drain(1)
                assert 'Reading fixture' in view('mouse-tab-return')

                with redirect_fixture() as (origin, final_received, form_submitted):
                    send(':open ' + origin + '/source\r'); drain(1)
                    assert 'ORIGINAL_CONTENT_MARKER' in view('redirect-source')
                    redirect_x, redirect_y = locate('Follow redirect')
                    click(1, redirect_x + 2, redirect_y)
                    deadline = time.monotonic() + 5
                    while not final_received.is_set() and time.monotonic() < deadline:
                        drain(0.1)
                    assert final_received.is_set(), 'Background redirect never reached its final response'
                    drain(0.5)
                    background = view('redirect-background-keeps-focus')
                    assert 'ORIGINAL_CONTENT_MARKER' in background, background
                    assert 'REDIRECT_FINAL_CONTENT_MARKER' not in background, background
                    send('gt'); drain(0.5)
                    assert 'REDIRECT_FINAL_CONTENT_MARKER' in view('redirect-background-final')
                    clipboard.unlink(missing_ok=True)
                    send('yy')
                    assert clipboard.read_text() == origin + '/final'
                    send('gT'); drain(0.5)
                    assert 'ORIGINAL_CONTENT_MARKER' in view('redirect-return-to-source')

                    # A foreground redirect still changes the visible buffer and URL.
                    final_received.clear()
                    redirect_x, redirect_y = locate('Follow redirect')
                    click(0, redirect_x + 2, redirect_y)
                    deadline = time.monotonic() + 5
                    while 'REDIRECT_FINAL_CONTENT_MARKER' not in '\n'.join(screen.display) and time.monotonic() < deadline:
                        drain(0.1)
                    assert final_received.is_set()
                    assert 'REDIRECT_FINAL_CONTENT_MARKER' in view('redirect-foreground-final')
                    clipboard.unlink(missing_ok=True)
                    send('yy')
                    assert clipboard.read_text() == origin + '/final'
                    send('H'); drain(0.5)
                    assert 'ORIGINAL_CONTENT_MARKER' in view('redirect-foreground-back')

                    # Form controls are clickable, but are not hyperlink targets.
                    # The next tab must remain the previously opened final page.
                    for control in ('INPUT_FIELD_MARKER', 'Submit marker'):
                        control_x, control_y = locate(control)
                        click(1, control_x + 2, control_y)
                        assert 'ORIGINAL_CONTENT_MARKER' in view('form-middle-keeps-page')
                        assert not form_submitted.is_set(), 'Middle click submitted a form'
                        send('gt'); drain(0.5)
                        assert 'REDIRECT_FINAL_CONTENT_MARKER' in view('form-middle-keeps-tabs')
                        send('gT'); drain(0.5)
                        control_x, control_y = locate(control)
                        click(2, control_x + 2, control_y)
                        form_menu = view('form-control-menu')
                        assert 'Open link' not in form_menu and 'Copy link URL' not in form_menu, form_menu
                        send('\x1b')
                    control_x, control_y = locate('INPUT_FIELD_MARKER')
                    click(0, control_x + 2, control_y)
                    assert 'TEXT:' in view('form-input-edit')
                    send('\x1b')
                    assert 'TEXT:' not in view('form-input-cancel')
                    assert not form_submitted.is_set(), 'Form was submitted during navigation checks'
                send(':open ' + str(fixture) + '\r'); drain(1)

                # Right-click uses personal commands; pick an entry using the mouse.
                click(2, 2, 2)
                menu = view('mouse-menu')
                assert 'Open URL / search' in menu and 'Load URL' not in menu, menu
                menu_x, menu_y = locate('Open URL / search')
                click(0, menu_x + 2, menu_y)
                assert 'URL:' in view('mouse-menu-open')
                send('\x1b')
                send(' ')
                assert 'Open URL / search' in view('menu-before-outside')
                click(0, 0, 0)
                assert 'Open URL / search' not in view('mouse-dismiss-menu')

                send(':open ' + str(long_fixture) + '\r'); drain(1)
                assert 'READER_ONLY_MARKER' in view('long-reader')
                drag_x, drag_y = locate('SELECT_EXACT_alpha_beta')
                mouse(0, drag_x, drag_y)
                mouse(0, drag_x + len('SELECT_EXACT_alpha_beta') - 1, drag_y, move=True)
                mouse(0, drag_x + len('SELECT_EXACT_alpha_beta') - 1, drag_y, release=True)
                send('y')
                assert clipboard.exists(), view('copy-missing')
                assert clipboard.read_text() == 'SELECT_EXACT_alpha_beta', repr(clipboard.read_text())
                view('mouse-selected-copy')

                # Opening this anchor externally must pass data as one argv entry.
                # Searching only positions the cursor; the http(s) URL is never fetched.
                send('/External safe link\r')
                send(':external-link\r'); drain(1)
                assert opened.exists(), view('external-open-missing')
                external_args = opened.read_bytes().split(b'\0')[:-1]
                assert external_args[-1] == external_url.encode(), external_args
                assert len(external_args) == 1 or external_args[:-1] == [b'--'], external_args
                assert not sentinel.exists(), 'External URL was evaluated as shell code'

                send('90G'); drain(0.5)
                before = visible_line()
                assert before > 40, view('long-before-style')
                send('gr'); drain(1)
                assert abs(visible_line() - before) <= 3, view('long-after-style')
                send('r'); drain(1)
                assert abs(visible_line() - before) <= 3, view('long-after-reload')
                send('gg')
                assert 'READER_ONLY_MARKER' not in view('reload-keeps-author-css')
                send('gr'); drain(1)
                assert 'READER_ONLY_MARKER' in view('restore-reader-style')
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
print('Packaged browser: reading, menus, command bar, finder, mouse navigation/selection, '
      'safe external opening, CSS/reload position, install, images passed.')
