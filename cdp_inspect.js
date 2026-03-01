// Test: verify the updated guard passes on the current Antigravity DOM
const http = require('http');
const WebSocket = require('ws');

// This is the EXACT guard logic from the updated extension.js
const TEST_SCRIPT = `
(function() {
    var results = {};
    
    // Check each guard selector individually
    results.reactAppContainer = !!document.querySelector('.react-app-container');
    results.agentClass = !!document.querySelector('[class*="agent"]');
    results.vscodeContext = !!document.querySelector('[data-vscode-context]');
    results.antigravitySidePanel = !!document.querySelector('.antigravity-agent-side-panel');
    results.antigravityClass = !!document.querySelector('[class*="antigravity"]');
    
    // The guard: if ALL are false, returns 'not-agent-panel'
    var guardPasses = results.reactAppContainer || results.agentClass || 
                      results.vscodeContext || results.antigravitySidePanel || 
                      results.antigravityClass;
    results.guardPasses = guardPasses;
    
    // Also check if we can find the "Always run" button
    var btns = document.querySelectorAll('button, [role="button"]');
    var foundAlwaysRun = false;
    for (var i = 0; i < btns.length; i++) {
        var txt = btns[i].textContent.trim().toLowerCase();
        if (txt === 'always run' || txt.startsWith('always run')) {
            foundAlwaysRun = true;
            break;
        }
    }
    results.foundAlwaysRunButton = foundAlwaysRun;
    
    return JSON.stringify(results);
})()
`;

async function main() {
    // Get all pages
    const pages = await new Promise((resolve, reject) => {
        const req = http.get({ hostname: '127.0.0.1', port: 9222, path: '/json/list', timeout: 2000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data).filter(p => p.webSocketDebuggerUrl && p.type === 'page')); } catch (e) { reject(e); } });
        });
        req.on('error', reject);
    });

    for (const page of pages) {
        const result = await new Promise((resolve) => {
            const ws = new WebSocket(page.webSocketDebuggerUrl);
            const timeout = setTimeout(() => { ws.close(); resolve(null); }, 3000);
            ws.on('open', () => {
                ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: TEST_SCRIPT } }));
            });
            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.id === 1) {
                    clearTimeout(timeout);
                    ws.close();
                    try { resolve(JSON.parse(msg.result?.result?.value || '{}')); }
                    catch (e) { resolve(null); }
                }
            });
            ws.on('error', () => { clearTimeout(timeout); resolve(null); });
        });

        if (result) {
            const status = result.guardPasses ? 'PASS' : 'BLOCKED';
            console.log(`[${status}] "${page.title.substring(0, 50)}" | guard=${result.guardPasses} agent=${result.agentClass} antigravity=${result.antigravityClass} sidePanel=${result.antigravitySidePanel} alwaysRun=${result.foundAlwaysRunButton}`);
        } else {
            console.log(`[ERROR] "${page.title.substring(0, 50)}" - could not connect`);
        }
    }
}

main().catch(console.error);
