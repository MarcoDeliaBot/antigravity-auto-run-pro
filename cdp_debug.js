// CDP Debug Script v2 — Targets ONLY the agent panel webview
// Filters out main window and non-agent webviews
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const CDP_PORTS = [9222, 9229, ...Array.from({ length: 15 }, (_, i) => 9000 + i)];

// Only scan webviews that look like the agent panel (vscode-webview:// URLs)
// Exclude the main window (Electron host) and extension host
function isAgentCandidate(page) {
    if (!page.webSocketDebuggerUrl) return false;
    const url = (page.url || '').toLowerCase();
    const title = (page.title || '').toLowerCase();
    // The agent panel runs in a vscode-webview:// iframe
    if (url.startsWith('vscode-webview://')) return true;
    // Also check for known agent panel titles
    if (title.includes('agent') || title.includes('launchpad')) return true;
    return false;
}

// Script injected into each candidate webview
// Looks for actionable buttons (Run, Accept, Allow, etc.) with strict matching
const script = `
(function() {
    // Check if this is the agent panel
    var isAgent = !!document.querySelector('.react-app-container') ||
                  !!document.querySelector('[class*="agent"]') ||
                  !!document.querySelector('[data-vscode-context]');
    
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    var node;
    var found = [];
    
    var ACTION_KEYWORDS = ['run', 'accept', 'allow', 'esegui', 'accetta', 'consenti',
                           'continue', 'proceed', 'continua', 'procedi', 'expand',
                           'reject', 'cancel', 'deny'];
    
    while (node = walker.nextNode()) {
        var tag = (node.tagName || '').toLowerCase();
        var role = node.getAttribute('role') || '';
        var isButton = tag === 'button' || role === 'button' || 
                       node.classList.contains('cursor-pointer') ||
                       tag === 'a' && node.classList.contains('action-label');
        
        if (!isButton) continue;
        
        // Get DIRECT text (not all descendants) to avoid mega-strings
        var directText = '';
        for (var i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].nodeType === 3) { // TEXT_NODE
                directText += node.childNodes[i].textContent;
            }
        }
        directText = directText.trim().toLowerCase();
        
        // Also check textContent but cap length to avoid noise
        var fullText = (node.textContent || '').trim().toLowerCase().substring(0, 80);
        var testText = directText || fullText;
        
        // Only report if it matches an action keyword
        var matched = false;
        for (var k = 0; k < ACTION_KEYWORDS.length; k++) {
            if (testText === ACTION_KEYWORDS[k] || 
                testText.startsWith(ACTION_KEYWORDS[k] + ' ') ||
                testText.startsWith(ACTION_KEYWORDS[k] + '\\t')) {
                matched = true;
                break;
            }
        }
        
        if (matched) {
            var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : {};
            found.push({
                tag: tag,
                text: testText.substring(0, 60),
                id: node.id || '',
                classes: (node.className || '').substring(0, 80),
                visible: (rect.width > 0 && rect.height > 0),
                x: Math.round(rect.x || 0),
                y: Math.round(rect.y || 0)
            });
        }
    }
    return { isAgent: isAgent, buttons: found };
})()
`;

async function scanPort(port) {
    return new Promise((resolve) => {
        const req = http.get({ hostname: '127.0.0.1', port, path: '/json/list', timeout: 1000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ port, pages: JSON.parse(data) }); }
                catch (e) { resolve({ port, pages: [] }); }
            });
        });
        req.on('error', () => resolve({ port, pages: [] }));
        req.on('timeout', () => { req.destroy(); resolve({ port, pages: [] }); });
    });
}

function evaluate(wsUrl) {
    return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { ws.close(); resolve(null); }, 3000);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: script, returnByValue: true } }));
        });
        ws.on('message', (msg) => {
            const res = JSON.parse(msg.toString());
            if (res.id === 1) {
                clearTimeout(timeout);
                ws.close();
                resolve(res.result?.result?.value || null);
            }
        });
        ws.on('error', () => { clearTimeout(timeout); resolve(null); });
    });
}

(async () => {
    const outputLines = [];

    for (const port of CDP_PORTS) {
        const { pages } = await scanPort(port);
        if (pages.length === 0) continue;

        outputLines.push(`\n═══ Port ${port}: ${pages.length} targets ═══`);

        const candidates = pages.filter(isAgentCandidate);
        const skipped = pages.length - candidates.length;
        if (skipped > 0) outputLines.push(`  (skipped ${skipped} non-agent targets)`);

        for (const page of candidates) {
            outputLines.push(`\n  ── ${page.title || page.url} ──`);
            try {
                const result = await evaluate(page.webSocketDebuggerUrl);
                if (!result) {
                    outputLines.push('    [no result]');
                    continue;
                }
                outputLines.push(`    isAgent: ${result.isAgent}`);
                if (result.buttons.length === 0) {
                    outputLines.push('    No action buttons found');
                } else {
                    outputLines.push(`    ${result.buttons.length} action button(s):`);
                    for (const btn of result.buttons) {
                        const vis = btn.visible ? '✓' : '✗';
                        outputLines.push(`      [${vis}] <${btn.tag}> "${btn.text}" at (${btn.x},${btn.y}) id="${btn.id}"`);
                    }
                }
            } catch (e) {
                outputLines.push(`    [error: ${e.message}]`);
            }
        }
        break; // Found active port, no need to scan more
    }

    if (outputLines.length === 0) {
        outputLines.push('No CDP debug port found. Start Antigravity with --remote-debugging-port=9222');
    }

    const output = outputLines.join('\n');
    console.log(output);
    fs.writeFileSync('cdp_out_utf8.txt', output, 'utf8');
})();
