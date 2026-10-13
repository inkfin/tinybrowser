/* Personal commands run in the browser UI, independently of website JS. */
globalThis.tiny = (() => {
    const local = name => 'file://' + getenv('TINYBROWSER_SHARE') + '/' + name;
    const home = () => pager.gotoURL(local('home.html'));
    const help = () => pager.gotoURL(local('help.html'));
    const cancel = () => pager.closeMenu();
    const closeOrQuit = () => pager.menu ? cancel() : quit();
    // hoverLink also contains form action URLs and labels such as <input>.
    // Resolve a real anchor before exposing actions that operate on a link.
    let anchor = null;
    const hasLink = () => Boolean(anchor && anchor.buffer === pager.buffer &&
        anchor.x === pager.buffer.cursorx && anchor.y === pager.buffer.cursory);
    const refreshAnchor = async () => {
        anchor = null;
        const buffer = pager.buffer;
        const iface = buffer?.iface;
        if (!iface) return;
        const x = buffer.cursorx;
        const y = buffer.cursory;
        const url = await iface.getLinkAt(x, y);
        if (url && pager.buffer === buffer && buffer.cursorx === x && buffer.cursory === y)
            anchor = {buffer, x, y, url};
    };
    const hasImage = () => Boolean(pager.buffer?.hoverImage);
    const hasSelection = () => Boolean(pager.buffer?.currentSelection);
    const onOff = value => value ? 'on' : 'off';
    const stateLabel = (label, field) => () => label + ' [' + onOff(pager.buffer?.init[field]) + ']';

    const toggleStyle = () => {
        const b = pager.buffer;
        if (!b) return;
        const next = pager.gotoURL(b.url, {
            replace: b, history: b.init.history,
            contentType: b.init.contentType, charset: b.init.charsetOverride,
            scripting: b.init.scripting, cookie: b.init.cookie,
            styling: !b.init.styling
        });
        if (next) next.init.copyCursorPos(b.iface ?? b.init);
    };

    // Keep explicit schemes, URLs and paths. Plain words become a web search.
    // This also covers the inherited address bar, pasted text and Ctrl-L.
    const addressTarget = text => {
        text = String(text).trim();
        if (!text || /^[a-z][a-z0-9+.-]*:/i.test(text) ||
            /^(?:\/|\.{1,2}\/|~(?:\/|$))/.test(text) ||
            (!/\s/.test(text) && (/[./]/.test(text) || /^localhost$|^\[[\da-f:]+\]$/i.test(text))))
            return text;
        return 's:' + text;
    };
    const loadSubmit = pager.loadSubmit;
    pager.loadSubmit = function(text, options) {
        return loadSubmit.call(this, addressTarget(text), options);
    };

    const copyText = (text, message) => {
        if (!text) return pager.alert('Nothing to copy here.');
        if (pager.clipboardWrite(String(text))) pager.alert(message);
        else pager.alert('Clipboard unavailable. Check terminal or platform clipboard support.');
    };
    const copySelection = async () => {
        if (!hasSelection()) return pager.alert('Select some text first.');
        copyText(await pager.buffer.getSelectionText(), 'Copied selected text.');
    };
    const external = (value = pager.buffer?.url) => {
        let url;
        try {
            const text = String(value ?? '');
            if (/[\x00-\x20\x7f]/.test(text)) throw new Error('Invalid URL');
            url = new URL(text);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Not a web URL');
        } catch (_) {
            return pager.alert('Only http(s) URLs can open in your system browser.');
        }
        // The command is constant. The untrusted URL is a separate env value,
        // and the helper passes it as one quoted argument to the OS opener.
        const ok = pager.extern('exec "$TINYBROWSER_SHARE/open-external"', {
            env: {TINYBROWSER_EXTERNAL_URL: String(url)}, suspend: false
        });
        pager.alert(ok ? 'Sent to system browser (requires open / xdg-open).' : 'Could not start the system-browser helper.');
    };

    // One fixed registry supplies menus, command lookup and dispatch. Context
    // actions appear only where they apply; no user input becomes executable JS.
    const entries = [
        {name: 'open', label: 'Open URL / search', key: 'o / Ctrl-L', run: () => pager.load('')},
        {name: 'search', label: 'Search the web', key: ':search words', run: () => pager.load('s:')},
        {name: 'back', label: 'Previous buffer', key: 'H', run: () => pager.prevBuffer()},
        {name: 'forward', label: 'Next buffer', key: 'L', run: () => pager.nextBuffer()},
        {name: 'buffers', label: 'Buffer list', key: ':buffers', run: () => buffers()},
        {name: 'close', label: 'Close buffer', key: 'x', run: () => pager.discardBuffer()},
        {name: 'bookmarks', label: 'Bookmarks', key: 'b', run: () => cmd.openBookmarks()},
        {name: 'bookmark', label: 'Bookmark this page', key: 'a', run: () => cmd.addBookmark()},
        {name: 'history', label: 'History', key: ':history', run: () => cmd.openHistory()},
        {name: 'reload', label: 'Reload page', key: 'r', run: () => pager.reload()},
        {name: 'images', label: stateLabel('Toggle images', 'images'), key: 'gi', run: () => pager.buffer.toggleImages()},
        {name: 'style', label: stateLabel('Toggle website CSS', 'styling'), key: 'gr', run: toggleStyle},
        {name: 'javascript', label: stateLabel('Toggle JS for this page', 'scripting'), key: ':javascript', run: () => cmd.toggleScripting()},
        {name: 'cookies', label: stateLabel('Toggle cookies for this page', 'cookie'), key: ':cookies', run: () => cmd.toggleCookie()},
        {name: 'copy', label: 'Copy page URL', key: 'yy', run: () => copyText(pager.buffer?.url, 'Copied page URL.')},
        {name: 'external', label: 'Open page in system browser', key: 'gx', run: () => external()},
        {name: 'x', label: 'Open X in system browser', key: ':x', run: () => external('https://x.com/home')},
        {name: 'save', label: 'Save page text', key: ':save', run: () => pager.buffer.saveScreen()},
        {name: 'source', label: 'View page source', key: ':source', run: () => pager.toggleSource()},
        {name: 'home', label: 'Home', key: 'gh', run: home},
        {name: 'help', label: 'Keybindings & commands', key: 'F1', run: help},
        {name: 'quit', label: 'Quit', key: 'q', run: quit},
        {name: 'select', label: 'Select text', key: 'v', context: true, when: () => !hasSelection(), run: () => pager.buffer.cursorToggleSelection()},
        {name: 'copy-selection', label: 'Copy selected text', key: 'y', context: true, when: hasSelection, run: copySelection},
        {name: 'open-link', label: 'Open link', key: 'Enter', context: true, when: hasLink, run: () => pager.click()},
        {name: 'tab-link', label: 'Open link in background tab', key: 'middle click', context: true, when: hasLink, run: () => pager.buffer.openLinkInNewTab()},
        {name: 'copy-link', label: 'Copy link URL', key: 'yl', context: true, when: hasLink, run: () => copyText(anchor.url, 'Copied link URL.')},
        {name: 'external-link', label: 'Open link in system browser', key: 'gX', context: true, when: hasLink, run: () => external(anchor.url)},
        {name: 'save-link', label: 'Save link', key: 's Enter', context: true, when: hasLink, run: () => pager.saveLink()},
        {name: 'view-image', label: 'View image', key: 'I', context: true, when: hasImage, run: () => cmd.viewImage()},
        {name: 'copy-image', label: 'Copy image URL', key: 'yI', context: true, when: hasImage, run: () => copyText(pager.buffer.hoverImage, 'Copied image URL.')},
        {name: 'edit-source', label: 'Edit page source', key: 'sE', context: true, run: () => pager.buffer.editSource()},
        {name: 'save-source', label: 'Save page source', key: 'sS', context: true, run: () => pager.buffer.saveSource()},
        {name: 'linkify', label: 'Make plain URLs clickable', key: ':linkify', context: true, run: () => pager.buffer.markURL()}
    ];
    const label = entry => (typeof entry.label === 'function' ? entry.label() : entry.label) + '  [' + entry.key + ']';
    const available = () => entries.filter(e => !e.when || e.when());

    async function pick(list, position) {
        const index = await pager.choose(list.map(label), position);
        if (index >= 0 && index < list.length) await list[index].run();
    }
    async function menu() {
        if (pager.menu) return cancel();
        await pick(available().filter(e => !e.context));
    }
    async function contextMenu(x, y) {
        await refreshAnchor();
        const actions = available();
        await pick(actions.filter(e => e.context).concat(actions.filter(e => !e.context)), {x, y});
    }
    async function buffers() {
        if (!pager.buffer) return;
        const current = pager.buffer;
        let b = current;
        while (b.prev) b = b.prev;
        const refs = [];
        for (; b; b = b.next) refs.push(b);
        const from = refs.indexOf(current);
        const list = refs.map((buffer, index) => ({
            name: 'buffer-' + index,
            label: (buffer === current ? '* ' : '  ') + String(buffer.title || buffer.url).slice(0, 55),
            key: String(index + 1),
            run: () => {
                for (let step = from; step < index; step++) pager.nextBuffer();
                for (let step = from; step > index; step--) pager.prevBuffer();
            }
        }));
        await pick(list);
    }
    async function palette() {
        pager.closeMenu();
        const query = await pager.prompt('Find command: ');
        if (query === null) return;
        await refreshAnchor();
        const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const list = available().filter(e => words.every(w => (e.name + ' ' + label(e)).toLowerCase().includes(w)));
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
            try { return pager.addTab(new URL(arg)); }
            catch (_) { return pager.alert('Invalid http(s) URL.'); }
        }
        const aliases = {q: 'quit', w: 'save', re: 'reload', css: 'style', js: 'javascript', cookie: 'cookies', twitter: 'x'};
        const entry = entries.find(e => e.name === (aliases[name] || name));
        if (!entry || arg) return pager.alert('Unknown command. Use Ctrl-P or F1.');
        if (entry.when === hasLink) await refreshAnchor();
        if (entry.when && !entry.when()) return pager.alert('This command is unavailable here.');
        await entry.run();
    }
    async function commandBar() {
        pager.closeMenu();
        const text = await pager.prompt(':');
        if (text !== null) await dispatch(text);
    }

    // Existing user profiles retain custom commands; only migrate the defaults.
    if (config.external.copyCmd === 'xsel -bi')
        config.external.copyCmd = '"$TINYBROWSER_SHARE/clipboard" copy';
    if (config.external.pasteCmd === 'xsel -bo')
        config.external.pasteCmd = '"$TINYBROWSER_SHARE/clipboard" paste';
    pager.openMenu = contextMenu;
    pager.modernMouse = true;
    return {home, help, cancel, closeOrQuit, toggleStyle, menu, palette, commandBar, dispatch};
})();
