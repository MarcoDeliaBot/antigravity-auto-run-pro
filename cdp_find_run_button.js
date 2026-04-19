/**
 * cdp_find_run_button.js
 * Run this script WHILE the "Run Alt+Enter" button is visible in Antigravity.
 */

const http = require('http');
const WebSocket = require('ws');

const PORTS = [9333, 9222, 9229, 9334, 9335, 9336, 9337, 9338, 9339, 9340];

const FIND_SCRIPT = `
(function() {
    var results = [];
    
    function textMatches(nodeText, target) {
        var n = nodeText.toLowerCase();
        var t = target.toLowerCase();
        if (n === t) return true;
        if (n.includes(t) && (n.includes('alt+') || n.includes('ctrl+') || n.includes('cmd+'))) return true;
        return false;
    }

    function walk(root, depth) {
        if (depth > 20) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        var node;
        while ((node = walker.nextNode())) {
            if (node.shadowRoot) walk(node.shadowRoot, depth + 1);
            var text = (node.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
            if (textMatches(text, 'run') || textMatches(text, 'esegui')) {
                // v1.8.15 STRICT FILTERS
                if (node.closest && (
                    node.closest('.monaco-editor') || 
                    node.closest('.terminal-wrapper') || 
                    node.closest('.terminal-container') || 
                    node.closest('.part.editor') ||
                    node.closest('[class*="message"]') || 
                    node.closest('.antigravity-message') ||
                    node.closest('[class*="command"]') ||
                    node.closest('[class*="preview"]') ||
                    node.closest('[class*="output"]') ||
                    node.closest('[class*="history"]')
                )) {
                    continue;
                }
                
                var tag = node.tagName;
                var rect = node.getBoundingClientRect();
                
                // v1.8.15 Strict Button Detection
                var isBtn = tag === 'BUTTON' || node.getAttribute('role') === 'button' ||
                            node.onclick != null || node.getAttribute('tabindex') === '0';
                
                if (rect.width > 0 && rect.height > 0) {
                    results.push({
                        tag: tag,
                        classes: (node.className || '').substring(0, 100),
                        text: text,
                        isButton: isBtn,
                        x: Math.round(rect.left + rect.width/2),
                        y: Math.round(rect.top + rect.height/2)
                    });
                }
            }
        }
    }
    walk(document.body, 0);
    return JSON.stringify(results);
})()
`;

async function evalInPage(wsUrl) {
    return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { ws.close(); resolve(null); }, 2000);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: FIND_SCRIPT } }));
        });
        ws.on('message', (data) => {
            clearTimeout(timeout);
            ws.close();
            try {
                const msg = JSON.parse(data.toString());
                const val = msg.result?.result?.value;
                resolve(val ? JSON.parse(val) : null);
            } catch(e) { resolve(null); }
        });
        ws.on('error', () => { clearTimeout(timeout); resolve(null); });
    });
}

async function getPages(port) {
    return new Promise((resolve) => {
        const req = http.get({ hostname: '127.0.0.1', port, path: '/json/list', timeout: 800 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data).filter(p => p.webSocketDebuggerUrl)); }
                catch(e) { resolve([]); }
            });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
    });
}

(async () => {
    console.log('Scanning CDP ports (v1.8.15 STRICT FILTERS)...\n');
    let found = false;
    for (const port of PORTS) {
        let pages;
        try { pages = await getPages(port); } catch(e) { continue; }
        if (!pages.length) continue;
        for (const page of pages) {
            const results = await evalInPage(page.webSocketDebuggerUrl);
            if (!results || !results.length) continue;
            console.log(`\n★★★ POTENTIAL MATCHES on port ${port} ★★★`);
            console.log(`    Page URL: ${page.url}`);
            results.forEach(r => {
                console.log(`    [${r.tag}] "${r.text}" | isButton=${r.isButton} | x=${r.x} y=${r.y}`);
                console.log(`    Classes: ${r.classes}`);
            });
            found = true;
        }
    }
    if (!found) console.log('\n✗ No "Run" button found with strict filters.');
    process.exit(0);
})();
