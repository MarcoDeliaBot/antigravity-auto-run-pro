// AntiGravity AutoAccept v1.4.1
// Primary: VS Code Commands API with async lock
// Secondary: Shadow DOM-piercing CDP for permission & action buttons

const vscode = require('vscode');
const http = require('http');
const WebSocket = require('ws');

// ─── VS Code Commands ─────────────────────────────────────────────────
// Only Antigravity-specific commands — generic VS Code commands like
// chatEditing.acceptAllFiles cause sidebar interference (Outline toggling,
// folder collapsing) when the agent panel lacks focus.
const ACCEPT_COMMANDS = [
    'antigravity.agent.acceptAgentStep',
    'antigravity.terminalCommand.accept',
    'antigravity.terminalCommand.run',
    'antigravity.command.accept',
];

// ─── Webview-Isolated Permission Clicker ──────────────────────────────
// Uses a Webview Guard to prevent execution on the main VS Code window.
// The agent panel runs in an isolated Chromium process (OOPIF) since
// VS Code's migration to Out-Of-Process Iframes.

// Safe texts: always auto-accepted (run/accept terminal commands)
const SAFE_TEXTS = [
    'run', 'accept',  // Primary action buttons first ("Run Alt+d", "Accept")
    'esegui', 'accetta', // Italian
    'continue', 'proceed',
    'continua', 'procedi',
    'allow once', 'consenti una volta', // Browser domain permission prompts
];

// Unsafe texts: only auto-accepted in God Mode (parent folder access)
// ⚠️ These grant the agent access to files outside the workspace
const UNSAFE_TEXTS = [
    'always allow', 'allow this conversation', 'allow',
    'consenti sempre', 'consenti in questa conversazione', 'consenti',
];

function buildPermissionScript(customTexts, godMode) {
    const allTexts = godMode
        ? [...SAFE_TEXTS, ...UNSAFE_TEXTS, ...customTexts]
        : [...SAFE_TEXTS, ...customTexts];
    // Pass godMode flag into the script so data-testid checks are conditional
    return `
(function() {
    var BUTTON_TEXTS = ${JSON.stringify(allTexts)};
    var GOD_MODE = ${godMode ? 'true' : 'false'};
    
    // ═══ WEBVIEW GUARD ═══
    // Check for Antigravity agent panel DOM markers.
    // The panel has .react-app-container; the main VS Code window doesn't.
    // This prevents false positives (sidebars, markdown, menus).
    if (!document.querySelector('.react-app-container') && 
        !document.querySelector('[class*="agent"]') &&
        !document.querySelector('[data-vscode-context]')) {
        return 'not-agent-panel';
    }
    
    // We are safely inside the isolated agent panel webview.
    // document.body IS the agent panel — no iframe needed.
    
    // ═══ STRICT TEXT EXTRACTION ═══
    // Get only DIRECT text of a node (not descendant text)
    // This prevents matching "run" inside "Test Runner for Java" etc.
    function getDirectText(node) {
        var text = '';
        for (var i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].nodeType === 3) { // TEXT_NODE
                text += node.childNodes[i].textContent;
            }
        }
        return text.trim().toLowerCase();
    }
    
    function closestClickable(node) {
        var el = node;
        while (el && el !== document.body) {
            var tag = (el.tagName || '').toLowerCase();
            if (tag === 'button' || tag.includes('button') || tag.includes('btn') ||
                el.getAttribute('role') === 'button' || el.classList.contains('cursor-pointer') ||
                el.onclick || el.getAttribute('tabindex') === '0') {
                return el;
            }
            el = el.parentElement;
        }
        return node;
    }
    
    // ═══ STRICT MATCH ═══
    // Match button text strictly: exact match, or known prefix patterns
    // like "run alt+d", "accept all", "esegui alt+d"
    function textMatches(nodeText, target) {
        if (nodeText === target) return true;
        // Allow "run alt+..." or "esegui alt+..." (keyboard shortcut suffix)
        if (nodeText.startsWith(target + ' alt+')) return true;
        if (nodeText.startsWith(target + ' ctrl+')) return true;
        // Allow "accept all" for target "accept"
        if (target === 'accept' && (nodeText === 'accept all' || nodeText.startsWith('accept all'))) return true;
        if (target === 'accetta' && (nodeText === 'accetta tutto' || nodeText.startsWith('accetta tutto'))) return true;
        // Longer targets (3+ chars) can use startsWith for multi-word buttons
        if (target.length >= 6 && nodeText.startsWith(target)) return true;
        return false;
    }
    
    function findButton(root, text) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        var node;
        while ((node = walker.nextNode())) {
            if (node.shadowRoot) {
                var result = findButton(node.shadowRoot, text);
                if (result) return result;
            }
            // Check data-testid / data-action for permission buttons
            // ═══ GOD MODE GUARD: only match allow-related data-testid in God Mode ═══
            if (GOD_MODE) {
                var testId = (node.getAttribute('data-testid') || node.getAttribute('data-action') || '').toLowerCase();
                if (testId.includes('alwaysallow') || testId.includes('always-allow') || testId.includes('allow')) {
                    var tag1 = (node.tagName || '').toLowerCase();
                    if (tag1 === 'button' || tag1.includes('button') || node.getAttribute('role') === 'button' || tag1.includes('btn')) {
                        return node;
                    }
                }
            }
            // ═══ USE DIRECT TEXT instead of full textContent ═══
            // This is the key fix: prevents matching "run" inside
            // "Test Runner for Java" or the IDE "Run" menu
            var directText = getDirectText(node);
            var fullText = (node.textContent || '').trim().toLowerCase();
            // For short targets like 'run', use DIRECT text only
            // For longer targets, allow full textContent as fallback
            var checkText = text.length <= 4 ? directText : (directText || fullText.substring(0, 40));
            
            if (textMatches(checkText, text)) {
                var clickable = closestClickable(node);
                var tag2 = (clickable.tagName || '').toLowerCase();
                if (tag2 === 'button' || tag2.includes('button') || clickable.getAttribute('role') === 'button' || 
                    tag2.includes('btn') || clickable.classList.contains('cursor-pointer') ||
                    clickable.onclick || clickable.getAttribute('tabindex') === '0' ||
                    text === 'expand' || text === 'requires input') {
                    return clickable;
                }
            }
        }
        return null;
    }
    
    for (var t = 0; t < BUTTON_TEXTS.length; t++) {
        var btn = findButton(document.body, BUTTON_TEXTS[t]);
        if (btn) {
            btn.click();
            return 'clicked:' + BUTTON_TEXTS[t];
        }
    }
    return 'no-permission-button';
})()
`;
}


let isEnabled = false;
let isAccepting = false; // Async lock — prevents double-accepts
let isGodMode = false;   // God Mode — also auto-accept folder access prompts
let pollIntervalId = null;
let cdpIntervalId = null;
let statusBarItem = null;
let godModeStatusBarItem = null;
let outputChannel = null;

function log(msg) {
    if (outputChannel) {
        outputChannel.appendLine(`${new Date().toLocaleTimeString()} ${msg}`);
    }
}

function updateStatusBar() {
    if (!statusBarItem) return;
    if (isEnabled) {
        statusBarItem.text = '$(zap) Auto: ON';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip = 'AntiGravity AutoAccept is ACTIVE — click to disable';
    } else {
        statusBarItem.text = '$(circle-slash) Auto: OFF';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'AntiGravity AutoAccept is OFF — click to enable';
    }
}

function updateGodModeStatusBar() {
    if (!godModeStatusBarItem) return;
    if (isGodMode) {
        godModeStatusBarItem.text = '$(flame) GOD';
        godModeStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        godModeStatusBarItem.tooltip = '⚠️ God Mode ACTIVE — auto-accepting folder access prompts. Click to disable.';
        godModeStatusBarItem.show();
    } else {
        godModeStatusBarItem.text = '$(shield) Safe';
        godModeStatusBarItem.backgroundColor = undefined;
        godModeStatusBarItem.tooltip = 'God Mode OFF — folder access prompts require manual approval. Click to enable.';
        godModeStatusBarItem.show();
    }
}

// ─── CDP Helpers ──────────────────────────────────────────────────────
function cdpGetPages(port) {
    return new Promise((resolve, reject) => {
        const req = http.get({ hostname: '127.0.0.1', port, path: '/json/list', timeout: 500 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data).filter(p => p.webSocketDebuggerUrl)); }
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

function cdpEvaluate(wsUrl, expression) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 2000);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression } }));
        });
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.id === 1) {
                clearTimeout(timeout);
                ws.close();
                resolve(msg.result?.result?.value || '');
            }
        });
        ws.on('error', () => { clearTimeout(timeout); reject(new Error('ws-error')); });
    });
}

// Send multiple CDP commands over one WebSocket connection
function cdpSendMulti(wsUrl, commands) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 3000);
        const results = {};
        let nextId = 1;
        const pending = [];

        ws.on('open', () => {
            for (const cmd of commands) {
                const id = nextId++;
                cmd._id = id;
                pending.push(id);
                ws.send(JSON.stringify({ id, method: cmd.method, params: cmd.params || {} }));
            }
        });
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.id) {
                results[msg.id] = msg.result || msg.error;
                const idx = pending.indexOf(msg.id);
                if (idx !== -1) pending.splice(idx, 1);
                if (pending.length === 0) {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(results);
                }
            }
        });
        ws.on('error', () => { clearTimeout(timeout); reject(new Error('ws-error')); });
    });
}

// Use CDP DOM protocol to pierce closed shadow DOMs and click the banner
async function clickBannerViaDom(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 3000);
        let msgId = 1;

        function send(method, params = {}) {
            const id = msgId++;
            ws.send(JSON.stringify({ id, method, params }));
            return id;
        }

        const handlers = {};
        ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.id && handlers[msg.id]) handlers[msg.id](msg);
        });
        ws.on('error', () => { clearTimeout(timeout); reject(new Error('ws-error')); });

        ws.on('open', () => {
            // Step 1: Get full DOM tree piercing shadow DOMs
            const docId = send('DOM.getDocument', { depth: -1, pierce: true });
            handlers[docId] = (msg) => {
                if (!msg.result) { clearTimeout(timeout); ws.close(); resolve(null); return; }

                // Step 2: Search for "Expand" text near the banner
                const searchId = send('DOM.performSearch', { query: 'Expand' });
                handlers[searchId] = (msg2) => {
                    const count = msg2.result?.resultCount || 0;
                    if (count === 0) { clearTimeout(timeout); ws.close(); resolve(null); return; }

                    // Step 3: Get search result nodes
                    const getResultsId = send('DOM.getSearchResults', {
                        searchId: msg2.result.searchId,
                        fromIndex: 0,
                        toIndex: Math.min(count, 10)
                    });
                    handlers[getResultsId] = (msg3) => {
                        const nodeIds = msg3.result?.nodeIds || [];
                        if (nodeIds.length === 0) { clearTimeout(timeout); ws.close(); resolve(null); return; }

                        // Step 4: Try each node — get its box model and click at center
                        let tried = 0;
                        function tryNode(idx) {
                            if (idx >= nodeIds.length) {
                                clearTimeout(timeout); ws.close(); resolve(null); return;
                            }
                            const boxId = send('DOM.getBoxModel', { nodeId: nodeIds[idx] });
                            handlers[boxId] = (boxMsg) => {
                                tried++;
                                const quad = boxMsg.result?.model?.content;
                                if (!quad || quad.length < 4) {
                                    tryNode(idx + 1); return; // not visible, try next
                                }
                                // Calculate center of the element
                                const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
                                const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
                                if (x === 0 && y === 0) { tryNode(idx + 1); return; }

                                // Step 5: Real mouse click at center coordinates
                                const downId = send('Input.dispatchMouseEvent', {
                                    type: 'mousePressed', x, y, button: 'left', clickCount: 1
                                });
                                handlers[downId] = () => {
                                    const upId = send('Input.dispatchMouseEvent', {
                                        type: 'mouseReleased', x, y, button: 'left', clickCount: 1
                                    });
                                    handlers[upId] = () => {
                                        clearTimeout(timeout);
                                        ws.close();
                                        resolve(`clicked:expand-mouse[${Math.round(x)},${Math.round(y)}]`);
                                    };
                                };
                            };
                        }
                        tryNode(0);
                    };
                };
            };
        });
    });
}

// Wider port scan: 9000-9014 + common Chromium/Node defaults
const CDP_PORTS = [9222, 9229, ...Array.from({ length: 15 }, (_, i) => 9000 + i)];

async function checkPermissionButtons() {
    if (!isEnabled) return;
    const config = vscode.workspace.getConfiguration('autorunpro');
    const customTexts = config.get('customButtonTexts', []);
    const script = buildPermissionScript(customTexts, isGodMode);
    try {
        for (const port of CDP_PORTS) {
            try {
                const pages = await cdpGetPages(port);
                if (pages.length === 0) continue;
                // Evaluate on all targets — the Webview Guard inside the script
                // handles isolation (non-webview targets return 'ignored-main-window')
                for (let i = 0; i < pages.length; i++) {
                    try {
                        const result = await cdpEvaluate(pages[i].webSocketDebuggerUrl, script);
                        if (result && result.startsWith('clicked:')) {
                            log(`[CDP] ✓ ${result}`);
                            return;
                        }
                    } catch (e) { /* next webview */ }
                }
                return;
            } catch (e) { /* next port */ }
        }
    } catch (e) { /* silent */ }
}

// ─── Polling with Async Lock ──────────────────────────────────────────
function startPolling() {
    if (pollIntervalId) return;

    const config = vscode.workspace.getConfiguration('autorunpro');
    const interval = config.get('pollInterval', 500);
    log(`Polling started (every ${interval}ms, ${ACCEPT_COMMANDS.length} commands)`);

    // VS Code commands — with async lock to prevent double-accepts
    pollIntervalId = setInterval(async () => {
        if (!isEnabled || isAccepting) return;
        isAccepting = true;
        try {
            await Promise.allSettled(
                ACCEPT_COMMANDS.map(cmd => vscode.commands.executeCommand(cmd))
            );
        } finally {
            isAccepting = false;
        }
    }, interval);

    // CDP permission polling (slower cadence)
    cdpIntervalId = setInterval(() => {
        checkPermissionButtons();
    }, 1500);
}

function stopPolling() {
    if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null; }
    if (cdpIntervalId) { clearInterval(cdpIntervalId); cdpIntervalId = null; }
    isAccepting = false;
    log('Polling stopped');
}

// ─── CDP Auto-Fix: Detect & Repair ───────────────────────────────────
const cp = require('child_process');

function checkAndFixCDP() {
    return new Promise((resolve) => {
        const req = http.get({ hostname: '127.0.0.1', port: 9222, path: '/json/list', timeout: 2000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                log('[CDP] Debug port active ✓');
                resolve(true);
            });
        });
        req.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                log('[CDP] ⚠ Port 9222 refused — remote debugging not enabled');
                // Fire the notification (non-blocking) — handle clicks via .then()
                vscode.window.showErrorMessage(
                    '⚡ AutoAccept needs Debug Mode to click buttons. Port 9222 is not open.',
                    'Auto-Fix Shortcut (Windows)',
                    'Manual Guide'
                ).then(action => {
                    if (action === 'Auto-Fix Shortcut (Windows)') {
                        applyPermanentWindowsPatch();
                    } else if (action === 'Manual Guide') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/yazanbaker94/AntiGravity-AutoAccept#setup'));
                    }
                });
            }
            resolve(false);
        });
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

function applyPermanentWindowsPatch() {
    if (process.platform !== 'win32') {
        vscode.window.showInformationMessage('Auto-patching is Windows-only. Use the Manual Guide.');
        return;
    }

    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    // Write a .ps1 file to avoid inline escaping issues with --remote-debugging-port
    const psFile = path.join(os.tmpdir(), 'antigravity_patch_shortcut.ps1');
    const psContent = `
$flag = "--remote-debugging-port=9222"
$WshShell = New-Object -comObject WScript.Shell
$paths = @(
    "$env:USERPROFILE\\Desktop",
    "$env:PUBLIC\\Desktop",
    "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs",
    "$env:ALLUSERSPROFILE\\Microsoft\\Windows\\Start Menu\\Programs"
)
$patched = $false
foreach ($dir in $paths) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            $shortcut = $WshShell.CreateShortcut($file.FullName)
            if ($shortcut.TargetPath -like "*Antigravity*") {
                if ($shortcut.Arguments -notlike "*remote-debugging-port*") {
                    $shortcut.Arguments = ($shortcut.Arguments + " " + $flag).Trim()
                    $shortcut.Save()
                    $patched = $true
                    Write-Output "PATCHED: $($file.FullName)"
                }
            }
        }
    }
}
if ($patched) { Write-Output "SUCCESS" } else { Write-Output "NOT_FOUND" }
`;

    try {
        fs.writeFileSync(psFile, psContent, 'utf8');
    } catch (e) {
        log(`[CDP] Failed to write patcher script: ${e.message}`);
        vscode.window.showWarningMessage('Could not create patcher script. Please add the flag manually.');
        return;
    }

    log('[CDP] Running shortcut patcher...');
    cp.exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, (err, stdout, stderr) => {
        // Clean up temp file
        try { fs.unlinkSync(psFile); } catch (e) { }

        if (err) {
            log(`[CDP] Patcher error: ${err.message}`);
            log(`[CDP] stderr: ${stderr}`);
            vscode.window.showWarningMessage('Shortcut patching failed. Please add the flag manually.');
            return;
        }
        log(`[CDP] Patcher output: ${stdout.trim()}`);
        if (stdout.includes('SUCCESS')) {
            log('[CDP] ✓ Shortcut patched!');
            vscode.window.showInformationMessage(
                '✅ Shortcut updated! Restart Antigravity for the fix to take effect.',
                'Restart Now'
            ).then(action => {
                if (action === 'Restart Now') applyTemporarySessionRestart();
            });
        } else {
            log('[CDP] No matching shortcuts found');
            vscode.window.showWarningMessage(
                'No Antigravity shortcut found on Desktop or Start Menu. Add --remote-debugging-port=9222 to your shortcut manually.'
            );
        }
    });
}

function applyTemporarySessionRestart() {
    vscode.window.showInformationMessage(
        '✅ Closing Antigravity — reopen from your Desktop/Start Menu shortcut to activate Debug Mode.',
        'Close Now'
    ).then(action => {
        if (action === 'Close Now') {
            vscode.commands.executeCommand('workbench.action.quit');
        }
    });
}

// ─── Activation ───────────────────────────────────────────────────────
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('AntiGravity AutoAccept');
    log('Extension activating (v1.4.1)');

    // Main toggle status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'autorunpro.toggle';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // God Mode status bar item (shown next to main toggle)
    godModeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    godModeStatusBarItem.command = 'autorunpro.toggleGodMode';
    context.subscriptions.push(godModeStatusBarItem);

    // Restore God Mode state from settings and persisted state
    const config = vscode.workspace.getConfiguration('autorunpro');
    isGodMode = config.get('godMode', false) || context.globalState.get('autorunproGodMode', false);
    updateGodModeStatusBar();

    context.subscriptions.push(
        vscode.commands.registerCommand('autorunpro.toggle', () => {
            isEnabled = !isEnabled;
            log(`Toggled: ${isEnabled ? 'ON' : 'OFF'}`);
            if (isEnabled) { startPolling(); } else { stopPolling(); }
            updateStatusBar();
            context.globalState.update('autorunproEnabled', isEnabled);
            vscode.window.showInformationMessage(
                `AntiGravity AutoAccept: ${isEnabled ? 'ENABLED ⚡' : 'DISABLED 🔴'}`
            );
        })
    );

    // God Mode toggle command
    context.subscriptions.push(
        vscode.commands.registerCommand('autorunpro.toggleGodMode', () => {
            isGodMode = !isGodMode;
            log(`God Mode: ${isGodMode ? 'ON ⚠️' : 'OFF'}`);
            updateGodModeStatusBar();
            context.globalState.update('autorunproGodMode', isGodMode);
            if (isGodMode) {
                vscode.window.showWarningMessage(
                    '⚠️ God Mode ENABLED — folder access prompts will be auto-accepted. The agent can now access files outside your workspace.'
                );
            } else {
                vscode.window.showInformationMessage(
                    '🛡️ God Mode DISABLED — folder access prompts require manual approval.'
                );
            }
        })
    );

    // Check CDP on activation — prompt auto-fix if port 9222 is closed
    checkAndFixCDP().then(cdpOk => {
        if (cdpOk) {
            // Restore saved state
            if (context.globalState.get('autorunproEnabled', false)) {
                isEnabled = true;
                startPolling();
            }
        } else {
            log('CDP not available — bot will not start until debug port is enabled');
        }
        updateStatusBar();
        log('Extension activated');
    });
}

function deactivate() {
    stopPolling();
    if (outputChannel) outputChannel.dispose();
}

module.exports = { activate, deactivate };
