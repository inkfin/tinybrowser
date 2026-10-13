const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const vm = require('node:vm');
const source = fs.readFileSync('personal/ui.js', 'utf8');

function browser(external = {copyCmd: 'xsel -bi', pasteCmd: 'xsel -bo'}) {
    const calls = [];
    const config = {external};
    const pager = {
        menu: null,
        buffer: {url: 'https://example.org/', title: 'Example', hoverLink: '', hoverImage: '',
            anchorURL: '', cursorx: 0, cursory: 0, iface: {getLinkAt: async () => pager.buffer.anchorURL},
            init: {styling: false, history: true, scripting: false, cookie: false, images: true}},
        loadSubmit: x => calls.push(['load', x]),
        load: x => calls.push(['prompt-url', x]),
        addTab: x => calls.push(['tab', String(x)]),
        alert: x => calls.push(['alert', x]),
        gotoURL: (url, options) => {
            calls.push(['goto', String(url), options]);
            return {init: {copyCursorPos: from => calls.push(['position', from])}};
        },
        clipboardWrite: text => { calls.push(['clipboard', text]); return true; },
        extern: (command, options) => { calls.push(['extern', command, options]); return true; },
        closeMenu: () => { pager.menu = null; calls.push(['close']); },
        prompt: async () => null,
        choose: async () => -1,
    };
    const cmd = {
        toggleCookie: () => { pager.buffer.init.cookie = !pager.buffer.init.cookie; },
        toggleScripting: () => { pager.buffer.init.scripting = !pager.buffer.init.scripting; }
    };
    const ctx = vm.createContext({pager, cmd, config, URL, getenv: () => '/test/share', quit: () => calls.push(['quit'])});
    vm.runInContext(source, ctx);
    return {tiny: ctx.tiny, pager, calls, config};
}

test('URL/search arguments stay data; command input never executes JS or a shell', async () => {
    const b = browser();
    await b.tiny.dispatch('open https://example.org/?q=$(touch%20test)');
    await b.tiny.dispatch('search unicode 中文 & shell; data');
    await b.tiny.dispatch('globalThis.pwned=true');
    assert.deepEqual(b.calls.slice(0, 2), [
        ['load', 'https://example.org/?q=$(touch%20test)'],
        ['load', 's:unicode 中文 & shell; data']
    ]);
    assert.equal(b.calls[2][0], 'alert');
    await b.tiny.dispatch('tabopen file:///etc/passwd');
    assert.equal(b.calls.at(-1)[0], 'alert');
    await b.tiny.dispatch('tabopen https://');
    assert.equal(b.calls.at(-1)[0], 'alert');
});

test('cancelled prompts and menus execute no action', async () => {
    const b = browser();
    await b.tiny.commandBar();
    await b.tiny.palette();
    await b.tiny.menu();
    assert.ok(b.calls.every(c => c[0] === 'close'));
});

test('finder filters words and dispatches the selected action', async () => {
    const b = browser();
    b.pager.prompt = async () => 'page URL';
    b.pager.choose = async options => {
        assert.equal(options.length, 1);
        assert.match(options[0], /Copy page URL/);
        return 0;
    };
    await b.tiny.palette();
    assert.deepEqual(b.calls.find(c => c[0] === 'clipboard'), ['clipboard', 'https://example.org/']);
});

test('CSS toggle preserves page policy, charset and reading position', () => {
    const b = browser();
    b.pager.buffer.init.charsetOverride = 'utf-8';
    b.pager.buffer.iface = {position: 300};
    b.tiny.toggleStyle();
    const [action, url, options] = b.calls[0];
    assert.equal(action, 'goto');
    assert.equal(url, 'https://example.org/');
    assert.equal(options.styling, true);
    assert.equal(options.scripting, false);
    assert.equal(options.cookie, false);
    assert.equal(options.charset, 'utf-8');
    assert.equal(options.replace, b.pager.buffer);
    assert.deepEqual(b.calls[1], ['position', b.pager.buffer.iface]);
});

test('q closes an open menu before quitting; unknown commands do not navigate', async () => {
    const b = browser();
    b.pager.menu = {};
    b.tiny.closeOrQuit();
    assert.deepEqual(b.calls, [['close']]);
    await b.tiny.dispatch('nonsense');
    assert.equal(b.calls.at(-1)[0], 'alert');
    b.tiny.closeOrQuit();
    assert.equal(b.calls.at(-1)[0], 'quit');
});

test('native menu is bounds-safe and toggles closed on a second invocation', async () => {
    const b = browser();
    b.pager.choose = async () => 999;
    await b.tiny.menu();
    assert.deepEqual(b.calls, []);
    b.pager.menu = {};
    await b.tiny.menu();
    assert.deepEqual(b.calls, [['close']]);
});

test('address entry searches words and preserves URLs, shortcuts and explicit file paths', async () => {
    const b = browser();
    for (const text of ['Nim async guide', '中文文档', 'python'])
        await b.tiny.dispatch('open ' + text);
    const unchanged = ['https://example.org/a', 'docs.python.org/3/', 's:hello', 'w:unicode',
        './notes and code.html', '../README', '~/notes.txt', '/tmp/notes.html', 'file:///tmp/a',
        'README.md', 'localhost', 'localhost:3000'];
    for (const text of unchanged) b.pager.loadSubmit(text);
    assert.deepEqual(b.calls.slice(0, 3), [
        ['load', 's:Nim async guide'], ['load', 's:中文文档'], ['load', 's:python']
    ]);
    assert.deepEqual(b.calls.slice(3).map(c => c[1]), unchanged);
});

test('context menu shares global actions and adds relevant link/selection choices', async () => {
    const b = browser();
    let main, context, position;
    b.pager.choose = async (items, at) => {
        if (at) { context = [...items]; position = at; }
        else main = [...items];
        return -1;
    };
    await b.tiny.menu();
    b.pager.buffer.hoverLink = 'https://example.org/link';
    b.pager.buffer.anchorURL = b.pager.buffer.hoverLink;
    await b.pager.openMenu(17, 8);
    assert.ok(main.every(item => context.includes(item)));
    assert.ok(context.some(item => item.startsWith('Open link in background tab')));
    assert.ok(context.some(item => item.startsWith('Copy link URL')));
    assert.ok(!context.some(item => item.startsWith('View image')));
    assert.ok(!context.some(item => item === 'Linkify URLs             (:)'));
    assert.equal(position.x, 17);
    assert.equal(position.y, 8);
    assert.equal(b.pager.modernMouse, true);
    b.pager.buffer.hoverLink = '';
    b.pager.buffer.anchorURL = '';
    b.pager.buffer.currentSelection = {};
    b.pager.buffer.getSelectionText = async () => 'printf("%s", value);';
    b.pager.choose = async items => items.findIndex(item => item.startsWith('Copy selected text'));
    await b.pager.openMenu(2, 3);
    assert.deepEqual(b.calls.find(c => c[0] === 'clipboard'), ['clipboard', 'printf("%s", value);']);
});

test('page policy labels show current state and cookie command stays in the fixed dispatcher', async () => {
    const b = browser();
    let labels;
    b.pager.choose = async items => { labels = items; return -1; };
    await b.tiny.menu();
    assert.ok(labels.some(s => s.startsWith('Toggle cookies for this page [off]')));
    assert.ok(labels.some(s => s.startsWith('Toggle JS for this page [off]')));
    await b.tiny.dispatch('cookies');
    await b.tiny.dispatch('javascript');
    await b.tiny.menu();
    assert.ok(labels.some(s => s.startsWith('Toggle cookies for this page [on]')));
    assert.ok(labels.some(s => s.startsWith('Toggle JS for this page [on]')));
});

test('form controls never expose or dispatch anchor actions even when hoverLink looks like a URL', async () => {
    const b = browser();
    let labels;
    b.pager.choose = async items => { labels = items; return -1; };
    b.pager.click = () => assert.fail('A link action must not submit a form');
    for (const hover of ['<input>', '<option>', 'https://example.org/form-submit?secret=value']) {
        b.pager.buffer.hoverLink = hover;
        b.pager.buffer.anchorURL = '';
        await b.pager.openMenu(3, 4);
        assert.ok(!labels.some(s => /^Open link|^Copy link URL|^Save link/.test(s)), hover);
        b.calls.length = 0;
        for (const command of ['open-link', 'tab-link', 'copy-link', 'external-link', 'save-link'])
            await b.tiny.dispatch(command);
        assert.equal(b.calls.length, 5);
        assert.ok(b.calls.every(c => c[0] === 'alert' && c[1] === 'This command is unavailable here.'));
    }
    // A real anchor remains available even if hover information is stale.
    b.pager.buffer.hoverLink = '<input>';
    b.pager.buffer.anchorURL = 'https://example.org/real-anchor';
    b.calls.length = 0;
    await b.tiny.dispatch('copy-link');
    assert.deepEqual(b.calls[0], ['clipboard', 'https://example.org/real-anchor']);
});

test('anchor actions ignore an asynchronous result after the cursor moves', async () => {
    const b = browser();
    b.pager.buffer.iface.getLinkAt = async () => {
        b.pager.buffer.cursorx++;
        return 'https://example.org/stale';
    };
    await b.tiny.dispatch('external-link');
    assert.ok(b.calls.every(c => c[0] !== 'extern'));
    assert.equal(b.calls.at(-1)[1], 'This command is unavailable here.');
});

test('external browsing validates protocols and transports untrusted URLs only through env', async () => {
    const b = browser();
    const url = 'https://example.org/?q=$(touch%20sentinel);value=$USER&quote=%27';
    b.pager.buffer.url = url;
    await b.tiny.dispatch('external');
    const [action, command, options] = b.calls[0];
    assert.equal(action, 'extern');
    assert.equal(command, 'exec "$TINYBROWSER_SHARE/open-external"');
    assert.equal(options.env.TINYBROWSER_EXTERNAL_URL, new URL(url).href);
    assert.equal(options.suspend, false);
    for (const bad of ['file:///tmp/a', 'javascript:alert(1)', 'cgi-bin:helper', 'https://', 'https://example.org/\ninjected']) {
        b.calls.length = 0;
        b.pager.buffer.url = bad;
        await b.tiny.dispatch('external');
        assert.ok(b.calls.every(c => c[0] !== 'extern'));
        assert.match(b.calls.at(-1)[1], /Only http/);
    }
    b.calls.length = 0;
    b.pager.buffer.hoverLink = 'https://example.org/another';
    b.pager.buffer.anchorURL = b.pager.buffer.hoverLink;
    await b.tiny.dispatch('external-link');
    assert.equal(b.calls[0][2].env.TINYBROWSER_EXTERNAL_URL, 'https://example.org/another');
    b.calls.length = 0;
    await b.tiny.dispatch('external https://ignored.example');
    assert.ok(b.calls.every(c => c[0] !== 'extern'));
});

test('X action opens the fixed system-browser destination and never loads native login', async () => {
    const b = browser();
    await b.tiny.dispatch('x');
    await b.tiny.dispatch('twitter');
    assert.equal(b.calls.filter(c => c[0] === 'extern').length, 2);
    assert.ok(b.calls.filter(c => c[0] === 'extern').every(c => c[2].env.TINYBROWSER_EXTERNAL_URL === 'https://x.com/home'));
    assert.ok(b.calls.every(c => c[0] !== 'load' && c[0] !== 'goto'));
});

test('clipboard fallback migrates only untouched upstream defaults', () => {
    const defaults = browser();
    assert.equal(defaults.config.external.copyCmd, '"$TINYBROWSER_SHARE/clipboard" copy');
    assert.equal(defaults.config.external.pasteCmd, '"$TINYBROWSER_SHARE/clipboard" paste');
    const custom = browser({copyCmd: 'my-copy-helper', pasteCmd: 'my-paste-helper'});
    assert.equal(custom.config.external.copyCmd, 'my-copy-helper');
    assert.equal(custom.config.external.pasteCmd, 'my-paste-helper');
});

test('OS opener helper passes malicious-looking URLs as one literal argument on Linux and Darwin', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tinybrowser external test '));
    try {
        const bin = path.join(root, 'bin');
        const share = path.join(root, 'share with spaces');
        fs.mkdirSync(bin);
        fs.mkdirSync(share);
        fs.copyFileSync('personal/open-external', path.join(share, 'open-external'));
        fs.chmodSync(path.join(share, 'open-external'), 0o755);
        fs.writeFileSync(path.join(bin, 'uname'), '#!/bin/sh\nprintf "%s\\n" "$TINYBROWSER_TEST_OS"\n', {mode: 0o755});
        const sink = '#!/bin/sh\nprintf "%s\\n" "$#" "$1" > "$TINYBROWSER_TEST_LOG"\n';
        for (const name of ['open', 'xdg-open'])
            fs.writeFileSync(path.join(bin, name), sink, {mode: 0o755});
        const sentinel = path.join(root, 'unexpected-file');
        const log = path.join(root, 'arguments');
        const url = 'https://example.invalid/?a=$(touch' + String.fromCharCode(36) +
            '{IFS}' + sentinel + ');x=' + String.fromCharCode(96) + 'id' +
            String.fromCharCode(96) + '&y=$USER';
        for (const platform of ['Linux', 'Darwin']) {
            const env = {...process.env, PATH: bin + ':/usr/bin:/bin',
                TINYBROWSER_SHARE: share, TINYBROWSER_EXTERNAL_URL: url,
                TINYBROWSER_TEST_OS: platform, TINYBROWSER_TEST_LOG: log};
            const result = spawnSync('/bin/sh', ['-c', 'exec "$TINYBROWSER_SHARE/open-external"'], {env, encoding: 'utf8'});
            assert.equal(result.status, 0, result.stderr);
            assert.equal(fs.readFileSync(log, 'utf8'), '1\n' + url + '\n');
            assert.equal(fs.existsSync(sentinel), false);
            fs.unlinkSync(log);
            const rejected = spawnSync('/bin/sh', ['-c', 'exec "$TINYBROWSER_SHARE/open-external"'],
                {env: {...env, TINYBROWSER_EXTERNAL_URL: 'file:///tmp/secret'}, encoding: 'utf8'});
            assert.equal(rejected.status, 2);
            assert.equal(fs.existsSync(log), false);
        }
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
