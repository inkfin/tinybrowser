const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('personal/ui.js', 'utf8');

function browser() {
    const calls = [];
    const pager = {
        menu: null,
        buffer: {url: 'https://example.org/', init: {styling: false, history: true, scripting: false, cookie: false}},
        loadSubmit: x => calls.push(['load', x]),
        load: x => calls.push(['prompt-url', x]),
        addTab: x => calls.push(['tab', x]),
        alert: x => calls.push(['alert', x]),
        gotoURL: (url, options) => calls.push(['goto', String(url), options]),
        closeMenu: () => { pager.menu = null; calls.push(['close']); },
        prompt: async () => null,
        choose: async () => -1,
    };
    const ctx = vm.createContext({pager, cmd: {}, getenv: () => '/test/share', quit: () => calls.push(['quit'])});
    vm.runInContext(source, ctx);
    return {tiny: ctx.tiny, pager, calls};
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
    // UI calls a built-in command by name, not a shell command.
    b.pager.clipboardWrite = () => {};
    const ctx = vm.createContext({pager: b.pager, cmd: {copyURL: () => b.calls.push(['copy'])}, getenv: () => '', quit() {}});
    vm.runInContext(source, ctx);
    await ctx.tiny.palette();
    assert.equal(b.calls.at(-1)[0], 'copy');
});

test('CSS toggle reloads only this buffer and preserves scripting/cookie policy', () => {
    const b = browser();
    b.tiny.toggleStyle();
    const [action, url, options] = b.calls[0];
    assert.equal(action, 'goto');
    assert.equal(url, 'https://example.org/');
    assert.equal(options.styling, true);
    assert.equal(options.scripting, false);
    assert.equal(options.cookie, false);
    assert.equal(options.replace, b.pager.buffer);
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
