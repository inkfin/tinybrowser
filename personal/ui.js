/* Personal commands run in the browser UI, independently of website JS. */
globalThis.tiny = (() => {
    const local = name => 'file://' + getenv('TINYBROWSER_SHARE') + '/' + name;
    const home = () => pager.gotoURL(local('home.html'));
    const help = () => pager.gotoURL(local('help.html'));
    const cancel = () => pager.closeMenu();
    const closeOrQuit = () => pager.menu ? cancel() : quit();
    const toggleStyle = () => {
        const b = pager.buffer;
        if (!b) return;
        pager.gotoURL(b.url, {
            replace: b, history: b.init.history,
            contentType: b.init.contentType,
            scripting: b.init.scripting, cookie: b.init.cookie,
            styling: !b.init.styling
        });
    };
    const entries = [
        ['open', 'Open URL / search', 'o', () => pager.load('')],
        ['search', 'Search the web', ':search words', () => pager.load('s:')],
        ['back', 'Previous buffer', 'H', () => pager.prevBuffer()],
        ['forward', 'Next buffer', 'L', () => pager.nextBuffer()],
        ['buffers', 'Buffer list', ':buffers', () => buffers()],
        ['bookmarks', 'Bookmarks', 'b', () => cmd.openBookmarks()],
        ['bookmark', 'Bookmark this page', 'a', () => cmd.addBookmark()],
        ['history', 'History', ':history', () => cmd.openHistory()],
        ['reload', 'Reload page', 'r', () => pager.reload()],
        ['images', 'Toggle images', 'gi', () => pager.buffer.toggleImages()],
        ['style', 'Toggle website CSS', 'gr', toggleStyle],
        ['javascript', 'Toggle JS for this page', ':javascript', () => cmd.toggleScripting()],
        ['copy', 'Copy page URL', 'yy', () => cmd.copyURL()],
        ['save', 'Save page text', ':save', () => pager.buffer.saveScreen()],
        ['source', 'View page source', ':source', () => pager.toggleSource()],
        ['home', 'Home', 'gh', home],
        ['help', 'Keybindings & commands', 'F1', help],
        ['quit', 'Quit', 'q', quit]
    ];

    async function pick(list) {
        const index = await pager.choose(list.map(e => e[1] + '  [' + e[2] + ']'));
        if (index >= 0 && index < list.length) await list[index][3]();
    }
    async function menu() {
        if (pager.menu) return cancel();
        await pick(entries);
    }
    async function buffers() {
        if (!pager.buffer) return;
        const current = pager.buffer;
        let b = current;
        while (b.prev) b = b.prev;
        const list = [];
        const refs = [];
        for (; b; b = b.next) refs.push(b);
        const from = refs.indexOf(current);
        refs.forEach((buffer, index) => list.push([
            'buffer-' + index,
            (buffer === current ? '* ' : '  ') + String(buffer.title).slice(0, 55),
            String(index + 1),
            () => {
                for (let step = from; step < index; step++) pager.nextBuffer();
                for (let step = from; step > index; step--) pager.prevBuffer();
            }
        ]));
        await pick(list);
    }
    async function palette() {
        pager.closeMenu();
        const query = await pager.prompt('Find command: ');
        if (query === null) return;
        const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const list = entries.filter(e => words.every(w => (e[0] + ' ' + e[1]).toLowerCase().includes(w)));
        if (!list.length) return pager.alert('No matching command. Try F1 for help.');
        await pick(list);
    }
    async function dispatch(text) {
        text = text.trim().replace(/^:/, '').trim();
        if (!text) return;
        const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(text);
        const name = match[1].toLowerCase();
        const arg = (match[2] || '').trim();
        if (name === 'open' || name === 'o')
            return arg ? pager.loadSubmit(arg) : pager.load('');
        if (name === 'search' || name === 's')
            return arg ? pager.loadSubmit('s:' + arg) : pager.load('s:');
        if (name === 'tabopen' || name === 't') {
            if (!arg) return pager.alert('Usage: tabopen https://example.org');
            if (!/^https?:\/\//i.test(arg)) return pager.alert('tabopen needs an http(s) URL.');
            return pager.addTab(arg);
        }
        const aliases = {q: 'quit', w: 'save', re: 'reload', css: 'style', js: 'javascript'};
        const entry = entries.find(e => e[0] === (aliases[name] || name));
        if (!entry || arg) return pager.alert('Unknown command. Use Ctrl-P or F1.');
        await entry[3]();
    }
    async function commandBar() {
        pager.closeMenu();
        const text = await pager.prompt(':');
        if (text !== null) await dispatch(text);
    }
    return {home, help, cancel, closeOrQuit, toggleStyle, menu, palette, commandBar, dispatch};
})();
