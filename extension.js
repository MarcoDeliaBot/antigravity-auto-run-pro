// AntiGravity AutoAccept v1.7.5 "The Overtaker"
// Primary: Persistent CDP WebSocket engine (Zero-Latency Pool)
// Features: Zero-Focus-Theft, Element Tagging, Rich Dashboard, Audit Mode
// Fixes v1.7.5: Permission prompts (Allow Once, etc.) not re-clicked during "Working.." (tagging exemption)

const vscode = require('vscode');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

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
    'always run', 'esegui sempre', // Agent Manager persistent auto-run
    'allow once', 'consenti una volta', // Browser domain permission prompts
    'expand', 'espandi',             // Agent status 'Expand' buttons (short form)
    'expand all', 'collapse all',    // FIX v1.7.3: full-text variants seen in agent UI
    'espandi tutto', 'comprimi tutto', // FIX v1.7.3: Italian full-text variants
    'requires input', 'richiede input', // Agent status 'Requires input' buttons
    'changes overview', 'panoramica modifiche', // Antigravity IDE pending file changes button
];

// Unsafe texts: only auto-accepted in God Mode (parent folder access)
// ⚠️ These grant the agent access to files outside the workspace
const UNSAFE_TEXTS = [
    'always allow', 'allow this conversation', 'allow',
    'consenti sempre', 'consenti in questa conversazione', 'consenti',
];

function buildPermissionScript(customTexts, godMode, standbyButton, auditMode, sessionId) {
    const allTexts = godMode
        ? [...SAFE_TEXTS, ...UNSAFE_TEXTS, ...customTexts]
        : [...SAFE_TEXTS, ...customTexts];
    // Pass godMode flag into the script so data-testid checks are conditional
    return `
(function() {
    var BUTTON_TEXTS = ${JSON.stringify(allTexts)};
    var GOD_MODE = ${godMode ? 'true' : 'false'};
    var STANDBY_BUTTON = ${standbyButton ? JSON.stringify(standbyButton) : 'null'};
    
    // ═══ WEBVIEW GUARD ═══
    if (!document.querySelector('.react-app-container') && 
        !document.querySelector('[class*="agent"]') &&
        !document.querySelector('[data-vscode-context]') &&
        !document.querySelector('.antigravity-agent-side-panel') &&
        !document.querySelector('[class*="antigravity"]')) {
        return 'not-agent-panel';
    }

    // ═══ TAGGING & AUDIT MODE ═══
    var AUDIT_MODE = ${auditMode ? 'true' : 'false'};
    var SESSION_ID = "${sessionId}";

    
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
            if (tag === 'button' || tag === 'a' || tag.includes('button') || tag.includes('btn') ||
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
    // FIX v1.7.3: strip leading/trailing whitespace and collapse inner spaces
    //             to tolerate buttons that embed icon elements between text nodes.
    function normalizeText(str) {
        return (str || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    }

    function textMatches(nodeText, target) {
        var n = normalizeText(nodeText);
        var t = normalizeText(target);
        if (n === t) return true;
        // Allow "run alt+..." or "esegui alt+..." (keyboard shortcut suffix)
        if (n.startsWith(t + ' alt+')) return true;
        if (n.startsWith(t + ' ctrl+')) return true;
        // Allow "accept all" for target "accept"
        if (t === 'accept' && (n === 'accept all' || n.startsWith('accept all'))) return true;
        if (t === 'accetta' && (n === 'accetta tutto' || n.startsWith('accetta tutto'))) return true;
        // FIX v1.7.3: expand / collapse variants — match if node text starts with or equals target
        // Covers "Expand all", "Expand All", "expand all steps", etc.
        if ((t === 'expand' || t === 'espandi') && (n === 'expand all' || n === 'espandi tutto' || n.startsWith('expand') || n.startsWith('espandi'))) return true;
        if ((t === 'collapse' || t === 'comprimi') && (n === 'collapse all' || n === 'comprimi tutto' || n.startsWith('collapse') || n.startsWith('comprimi'))) return true;
        // Longer targets (6+ chars) can use startsWith for multi-word buttons
        if (t.length >= 6 && n.startsWith(t)) return true;
        // Handle "1 step requires input" or localized variants
        if (t === 'requires input' && n.includes('requires input')) return true;
        if (t === 'richiede input' && n.includes('richiede input')) return true;
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
            // FIX v1.7.3: for expand/collapse targets always try fullText too
            //             because the icon <svg> sits between text nodes, making
            //             directText incomplete (e.g. "" instead of "Expand all").
            var isExpandTarget = (text === 'expand' || text === 'espandi' ||
                                  text === 'expand all' || text === 'espandi tutto' ||
                                  text === 'collapse' || text === 'comprimi' ||
                                  text === 'collapse all' || text === 'comprimi tutto');
            // For short targets like 'run', use DIRECT text only
            // For longer targets or expand targets, allow full textContent as fallback
            var checkText = (text.length <= 4 && !isExpandTarget)
                ? directText
                : (directText || fullText.substring(0, 60));
            
            if (textMatches(checkText, text)) {
                var clickable = closestClickable(node);
                var tag2 = (clickable.tagName || '').toLowerCase();
                // Enhanced match for 'expand' and permission buttons with specific Antigravity patterns
                var textLower = (clickable.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
                var isExpand = isExpandTarget || textLower.includes('expand') || textLower.includes('espandi') ||
                               textLower.includes('collapse') || textLower.includes('comprimi');
                var isPermission = (text.includes('allow') || text.includes('consenti'));
                
                if (tag2 === 'button' || tag2.includes('button') || clickable.getAttribute('role') === 'button' || 
                    tag2.includes('btn') || clickable.classList.contains('cursor-pointer') ||
                    clickable.onclick || clickable.getAttribute('tabindex') === '0' ||
                    isExpand || isPermission || text === 'requires input' || textLower === 'accept all' || textLower === 'accetta tutto') {
                    return clickable;
                }
            }
        }
        return null;
    }
    // ═══ GENERATION CHECK ═══
    function isGenerating() {
        var walkers = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        var n;
        while ((n = walkers.nextNode())) {
            var text = (n.textContent || '').trim().toLowerCase();
            if (n.tagName === 'BUTTON' && (text === 'interrupt' || text === 'stop generating' || text === 'cancel' || text === 'interrompi')) {
                return true;
            }
            if (n.getAttribute('data-testid') === 'interrupt-button' || n.getAttribute('aria-label') === 'Interrupt') {
                return true;
            }
            // Check for typical loaders or generating indicators if needed
        }
        return false;
    }

    if (isGenerating()) {
        return 'generating';
    }

    // ═══ DETERMINISTIC FINGERPRINTING (Hash) ═══
    function getHashCode(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    // ═══ ROBUST UI SELECTORS (Fallback Chain) ═══
    function getAssistantOutput() {
        var selectors = [
            '[data-testid="assistant-message"]:last-of-type',
            '.antigravity-message.assistant:last-child',
            '[class*="assistant-message"]:last-child',
            '[class*="agent-message"]:last-child',
            'div[class*="message"]:last-child' // Broad fallback
        ];
        for (var s = 0; s < selectors.length; s++) {
            var el = document.querySelector(selectors[s]);
            if (el && el.textContent.trim().length > 5) {
                return { text: el.textContent.trim(), selector: selectors[s] };
            }
        }
        return null;
    }

    var outputData = getAssistantOutput();
    var fingerprint = outputData ? getHashCode(outputData.text) : 'no-output';
    var selectorUsed = outputData ? outputData.selector : 'none';
    
    for (var t = 0; t < BUTTON_TEXTS.length; t++) {
        var btn = findButton(document.body, BUTTON_TEXTS[t]);
        if (btn) {
            if (STANDBY_BUTTON === BUTTON_TEXTS[t]) {
                return 'standby-present:' + BUTTON_TEXTS[t] + '|' + fingerprint + '|' + selectorUsed;
            }
            
            // Industrial Tagging Check
            // FIX v1.7.4: Exempt re-clickable buttons (expand, collapse, requires input,
            // changes overview) from the tagging guard. These are idempotent UI toggles
            // that MUST be re-clicked even when the agent output (fingerprint) hasn't changed,
            // e.g. during the "Waiting.." state where "1 Step Requires Input — Expand" persists.
            var isReClickable = (
                BUTTON_TEXTS[t] === 'expand' || BUTTON_TEXTS[t] === 'espandi' ||
                BUTTON_TEXTS[t] === 'expand all' || BUTTON_TEXTS[t] === 'espandi tutto' ||
                BUTTON_TEXTS[t] === 'collapse all' || BUTTON_TEXTS[t] === 'comprimi tutto' ||
                BUTTON_TEXTS[t] === 'requires input' || BUTTON_TEXTS[t] === 'richiede input' ||
                BUTTON_TEXTS[t] === 'changes overview' || BUTTON_TEXTS[t] === 'panoramica modifiche' ||
                BUTTON_TEXTS[t].includes('allow') || BUTTON_TEXTS[t].includes('consenti')
            );
            if (!isReClickable && btn.getAttribute('data-ag-clicked') === fingerprint) {
                return 'already-clicked:' + BUTTON_TEXTS[t];
            }

            if (AUDIT_MODE) {
                return 'audit-match:' + BUTTON_TEXTS[t] + '|' + fingerprint;
            }

            // Zero Focus Theft: Prevent blur/focus shift during click
            var preventer = function(e) { e.stopPropagation(); };
            btn.addEventListener('blur', preventer, true);
            
            btn.click();
            btn.setAttribute('data-ag-clicked', fingerprint);
            btn.setAttribute('data-ag-session', SESSION_ID);
            
            setTimeout(function() { btn.removeEventListener('blur', preventer, true); }, 500);

            return 'clicked:' + BUTTON_TEXTS[t] + '|' + fingerprint + '|' + selectorUsed;
        }
    }
    return 'no-permission-button';
})()
`;
}



let isEnabled = false;
let isAccepting = false;
let isGodMode = false;
let isStandby = false;
let isAuditMode = false;
let standbyButton = null;
let currentSessionId = Math.random().toString(36).substring(2, 10);

// Stats for Dashboard
let totalClicks = 0;
let lastActionTime = 0;
let lastActionText = 'None';
let cdpStatus = 'Disconnected';


// ═══ GLOBAL ANTI-LOOP VARS (v1.6.1) ═══
let globalCooldownUntil = 0; // Debouncing/Cooldown timestamp
let sessionClickCount = 0;   // Kill switch counter
let sessionStartTime = Date.now();
// Backoff Constants
const BACKOFF_BASE_MS = 3000;
const BACKOFF_MAX_MS = 60000; // Max 1 minute wait
// ═══════════════════════════════════════

let pollIntervalId = null;
let cdpIntervalId = null;
let statusBarItem = null;
let godModeStatusBarItem = null;
let bypassStatusBarItem = null;
let outputChannel = null;
let extensionContext = null; // Global context for storage path

function log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const fullMsg = `${timestamp} ${msg}`;
    if (outputChannel) {
        outputChannel.appendLine(fullMsg);
    }
    logToFile(fullMsg);
}

function logToFile(msg) {
    try {
        if (!extensionContext) return;

        const storageUri = extensionContext.globalStorageUri;
        if (!storageUri) return;

        const storagePath = storageUri.fsPath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }

        const logPath = path.join(storagePath, 'autorun_pro.log');
        fs.appendFileSync(logPath, msg + '\n', 'utf8');
    } catch (e) {
        // Silent fail for logging
    }
}

// Throttled logging to avoid spamming the console every 500ms when an error persists
let lastLogTimes = {};
function logThrottled(key, msg, throttleMs = 30000) {
    const now = Date.now();
    if (!lastLogTimes[key] || now - lastLogTimes[key] > throttleMs) {
        log(msg);
        lastLogTimes[key] = now;
    }
}

function updateStatusBar() {
    if (!statusBarItem) return;
    
    // Industrial Dashboard Tooltip
    const dashboard = [
        `Antigravity Auto Run Pro v1.7.5`,
        `───────────────────────────`,
        `Mode: ${isEnabled ? (isStandby ? 'STANDBY' : 'ACTIVE') : 'OFF'}`,
        `God Mode: ${isGodMode ? '🔥 ON' : '🛡️ Safe'}`,
        `Audit Mode: ${isAuditMode ? '🔍 ON' : 'OFF'}`,
        `CDP Status: ${cdpStatus}`,
        `───────────────────────────`,
        `Session Stats:`,
        `- Total Clicks: ${totalClicks}`,
        `- Last Action: ${lastActionText}`,
        `- Last Active: ${lastActionTime ? new Date(lastActionTime).toLocaleTimeString() : 'N/A'}`,
        `- Backoff Level: ${Math.max(consecutiveClickCount, consecutiveFingerprintCount)}`,
        `───────────────────────────`,
        `Click to toggle ON/OFF`
    ].join('\n');

    statusBarItem.tooltip = dashboard;

    if (isEnabled) {
        if (isStandby) {
            statusBarItem.text = '$(clock) Auto: STANDBY';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            statusBarItem.text = isAuditMode ? '$(search) Auto: AUDIT' : '$(zap) Auto: ON';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    } else {
        statusBarItem.text = '$(circle-slash) Auto: OFF';
        statusBarItem.backgroundColor = undefined;
    }
}

function updateGodModeStatusBar() {
    if (!godModeStatusBarItem) return;
    godModeStatusBarItem.text = isGodMode ? '$(flame) GOD' : '$(shield) Safe';
    godModeStatusBarItem.backgroundColor = isGodMode ? new vscode.ThemeColor('statusBarItem.errorBackground') : undefined;
    godModeStatusBarItem.show();
}

function updateBypassStatusBar() {
    if (!bypassStatusBarItem) return;
    const now = Date.now();
    if (isEnabled && globalCooldownUntil > now && !isStandby) {
        const remaining = Math.ceil((globalCooldownUntil - now) / 1000);
        bypassStatusBarItem.text = `$(zap) Skip ${remaining}s`;
        bypassStatusBarItem.show();
    } else {
        bypassStatusBarItem.hide();
    }
}


// ─── CDP Helpers ──────────────────────────────────────────────────────
const wsPool = new Map(); // Industrial WebSocket Pool (Zero Latency)

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
        let ws = wsPool.get(wsUrl);
        
        // Eviction logic: check if existing socket is still open
        if (ws && ws.readyState !== WebSocket.OPEN) {
            try { ws.close(); } catch(e) {}
            wsPool.delete(wsUrl);
            ws = null;
        }

        if (!ws) {
            ws = new WebSocket(wsUrl);
            wsPool.set(wsUrl, ws);
            ws.on('error', () => { wsPool.delete(wsUrl); });
            ws.on('close', () => { wsPool.delete(wsUrl); });
        }

        const timeout = setTimeout(() => { resolve(null); }, 1500);
        
        const onMessage = (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.id === 1) {
                    clearTimeout(timeout);
                    ws.removeListener('message', onMessage);
                    resolve(msg.result?.result?.value || '');
                }
            } catch (e) { resolve(null); }
        };

        if (ws.readyState === WebSocket.OPEN) {
            ws.on('message', onMessage);
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression } }));
        } else {
            ws.on('open', () => {
                ws.on('message', onMessage);
                ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression } }));
            });
        }
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

let isCheckingCDP = false;
let lastClickedButton = null;
let lastClickedTime = 0;
let consecutiveClickCount = 0;
let lastAgentFingerprint = '';
let consecutiveFingerprintCount = 0;
let lastUsedSelector = 'none';

async function checkPermissionButtons() {
    if (!isEnabled || isCheckingCDP) return;
    isCheckingCDP = true;

    const config = vscode.workspace.getConfiguration('autorunpro');
    const customTexts = config.get('customButtonTexts', []);
    const script = buildPermissionScript(customTexts, isGodMode, standbyButton, isAuditMode, currentSessionId);
    let anyConnected = false;   // true = at least one CDP port responded (HTTP)
    let cdpAttempted = false;   // FIX v1.7.3: true = found at least one page/target
    let watchdogTimer = null;   // FIX v1.7.3: declared here so finally{} clearTimeout is safe
    cdpStatus = 'Disconnected';

    try {
        for (const port of CDP_PORTS) {
            try {
                const pages = await cdpGetPages(port);
                anyConnected = true;                    // port responded to HTTP
                if (pages.length === 0) continue;
                cdpAttempted = true;                    // FIX v1.7.3: found targets
                cdpStatus = `Connected (Port ${port})`;

                for (let i = 0; i < pages.length; i++) {
                    try {
                        const result = await cdpEvaluate(pages[i].webSocketDebuggerUrl, script);
                        if (!result) continue;

                        if (result.startsWith('clicked:') || result.startsWith('audit-match:')) {
                            const isAudit = result.startsWith('audit-match:');
                            const prefix = isAudit ? 'audit-match:' : 'clicked:';
                            const parts = result.substring(prefix.length).split('|');
                            const btnText = parts[0];
                            const fingerprint = parts[1] || '';
                            const selector = parts[2] || 'unknown';
                            const now = Date.now();

                            if (!isAudit) {
                                totalClicks++;
                                lastActionTime = now;
                                lastActionText = `Clicked "${btnText}"`;
                                
                                // Anti-loop Logic
                                if (btnText === lastClickedButton && (now - lastClickedTime) < 10000) {
                                    consecutiveClickCount++;
                                } else {
                                    consecutiveClickCount = 1;
                                    lastClickedButton = btnText;
                                }

                                if (fingerprint !== 'no-output' && fingerprint === lastAgentFingerprint) {
                                    consecutiveFingerprintCount++;
                                } else {
                                    consecutiveFingerprintCount = 1;
                                    consecutiveClickCount = 1;
                                    lastAgentFingerprint = fingerprint;
                                }
                                lastClickedTime = now;

                                // FIX v1.7.3: include all expand/collapse variants in high-tolerance set
                                const isHighToleranceBtn = (
                                    btnText === 'expand' || btnText === 'espandi' ||
                                    btnText === 'expand all' || btnText === 'espandi tutto' ||
                                    btnText === 'collapse all' || btnText === 'comprimi tutto' ||
                                    btnText === 'always run' || btnText === 'esegui sempre' ||
                                    btnText.includes('allow') || btnText.includes('consenti')
                                );
                                const loopThreshold = isHighToleranceBtn ? 30 : 15;
                                if (consecutiveClickCount > loopThreshold) {
                                    log(`[CDP] 🔴 LOOP: ${btnText} (${consecutiveClickCount}x)`);
                                    isStandby = true;
                                    standbyButton = btnText;
                                }
                            } else {
                                lastActionText = `Audit: Found "${btnText}"`;
                                log(`[Audit] Found "${btnText}" [Hash: ${fingerprint}]`);
                            }

                            updateStatusBar();
                            isCheckingCDP = false;
                            return;
                        } else if (result === 'no-permission-button') {
                            if (isStandby) {
                                log(`[CDP] 🟢 Button disappeared. Exiting STANDBY mode.`);
                                vscode.window.showInformationMessage(`▶️ AntiGravity AutoRun: Standby ended. Resuming auto-run.`);
                                isStandby = false;
                                standbyButton = null;
                                consecutiveClickCount = 0;
                                updateStatusBar();
                            }
                        }
                    } catch (e) {
                        logThrottled('cdp-eval-error', `[CDP] ⚠️ Eval error on port ${port}: ${e.message}`, 60000);
                    }
                }
            } catch (e) { /* port not open, next port */ }
        }
        // If we reach here, we exhausted all ports
        if (!anyConnected) {
            logThrottled('cdp-no-connect', '[CDP] 🔴 Could not connect to any CDP port. Is Debug Mode disabled?', 60000);
        } else if (!cdpAttempted) {
            // FIX v1.7.3: cdpAttempted is now properly declared above — no more ReferenceError
            logThrottled('cdp-no-pages', '[CDP] ⚠️ Connected to Debug port, but no webview targets found.', 60000);
        }

    } catch (e) {
        logThrottled('cdp-fatal', `[CDP] 🔴 Fatal error in polling: ${e.message}`, 60000);
    } finally {
        // FIX v1.7.3: watchdogTimer is now declared as null above — clearTimeout(null) is a no-op, safe
        clearTimeout(watchdogTimer);
    }

    isCheckingCDP = false;
}

// ─── Polling with Async Lock and Jitter ─────────────────────────────────
let isPollingActive = false;

function getRandomJitter(base, variationPercent) {
    const variation = base * variationPercent;
    return base + (Math.random() * variation * 2 - variation);
}

function startPolling() {
    if (isPollingActive) return;
    isPollingActive = true;

    const config = vscode.workspace.getConfiguration('autorunpro');
    const baseInterval = config.get('pollInterval', 500);
    log(`Polling started (Base interval ${baseInterval}ms, ${ACCEPT_COMMANDS.length} commands, with jitter)`);

    // VS Code commands mapping - recursive setTimeout
    async function runVsCodePolling() {
        if (!isPollingActive || !isEnabled) return;
        
        const now = Date.now();
        if (now < globalCooldownUntil) {
            // In cooldown, skip checking APIs but reschedule
            updateBypassStatusBar();
            pollIntervalId = setTimeout(runVsCodePolling, 500);
            return;
        }
        updateBypassStatusBar();

        if (!isAccepting && !isStandby) {
            isAccepting = true;
            try {
                const results = await Promise.allSettled(
                    ACCEPT_COMMANDS.map(cmd => vscode.commands.executeCommand(cmd))
                );

                let anyAccepted = false;
                results.forEach((res, idx) => {
                    if (res.status === 'rejected') {
                        const errMsg = (res.reason && res.reason.message) ? res.reason.message : String(res.reason);
                        if (!errMsg.toLowerCase().includes('not found') && !errMsg.toLowerCase().includes('not enabled')) {
                            logThrottled(`vs-cmd-${idx}`, `[VSCode API] \u26A0\uFE0F Cmd ${ACCEPT_COMMANDS[idx]} rejected: ${errMsg}`);
                        }
                    } else if (res.status === 'fulfilled') {
                        // In VS Code extensions it's hard to know if executeCommand actually did something 
                        // just by 'fulfilled', but if we wanted to register a cooldown we could do it here
                        // However we rely mainly on CDP for the strong cooldowns for visible actions
                    }
                });
            } catch (e) {
                logThrottled('vs-cmd-fatal', `[VSCode API] \uD83D\uDD34 Fatal polling error: ${(e && e.message) ? e.message : String(e)}`);
            } finally {
                isAccepting = false;
            }
        }
        
        // Schedule next run with ±30% jitter
        const nextDelay = getRandomJitter(baseInterval, 0.3);
        pollIntervalId = setTimeout(runVsCodePolling, nextDelay);
    }

    // CDP permission polling mapping - recursive setTimeout
    async function runCdpPolling() {
        if (!isPollingActive || !isEnabled) return;
        
        const now = Date.now();
        if (now >= globalCooldownUntil) {
            await checkPermissionButtons();
        }
        updateBypassStatusBar();
        
        // Slower cadence for CDP, e.g., base 1500ms with ±20% jitter
        const nextDelay = getRandomJitter(1500, 0.2);
        cdpIntervalId = setTimeout(runCdpPolling, nextDelay);
    }

    // Kick off the loops
    runVsCodePolling();
    runCdpPolling();
}

function stopPolling() {
    isPollingActive = false;
    if (pollIntervalId) { clearTimeout(pollIntervalId); pollIntervalId = null; }
    if (cdpIntervalId) { clearTimeout(cdpIntervalId); cdpIntervalId = null; }
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
    extensionContext = context;
    outputChannel = vscode.window.createOutputChannel('AntiGravity AutoAccept');
    log('Extension activating (v1.7.5 "The Overtaker")');

    // Main toggle status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'autorunpro.toggle';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // God Mode status bar item (shown next to main toggle)
    godModeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    godModeStatusBarItem.command = 'autorunpro.toggleGodMode';
    context.subscriptions.push(godModeStatusBarItem);

    // Bypass timer status bar item
    bypassStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    bypassStatusBarItem.command = 'autorunpro.bypassTimer';
    bypassStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    context.subscriptions.push(bypassStatusBarItem);

    // Restore God Mode state from settings and persisted state
    const config = vscode.workspace.getConfiguration('autorunpro');
    isGodMode = config.get('godMode', false) || context.globalState.get('autorunproGodMode', false);
    updateGodModeStatusBar();

    context.subscriptions.push(
        vscode.commands.registerCommand('autorunpro.toggle', () => {
            isEnabled = !isEnabled;
            log(`Toggled: ${isEnabled ? 'ON' : 'OFF'}`);
            if (isEnabled) {
                isStandby = false;
                standbyButton = null;
                consecutiveClickCount = 0;
                startPolling();
            } else {
                stopPolling();
            }
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

    // Bypass timer command
    context.subscriptions.push(
        vscode.commands.registerCommand('autorunpro.bypassTimer', () => {
            log('Timer bypassed manually');
            globalCooldownUntil = 0;
            updateBypassStatusBar();
        })
    );

    // Audit Mode toggle command
    context.subscriptions.push(
        vscode.commands.registerCommand('autorunpro.toggleAudit', () => {
            isAuditMode = !isAuditMode;
            log(`Audit Mode: ${isAuditMode ? 'ON 🔍' : 'OFF'}`);
            updateStatusBar();
            vscode.window.showInformationMessage(
                `AntiGravity AutoAccept: Audit Mode ${isAuditMode ? 'ENABLED (Dry-run)' : 'DISABLED'}`
            );
        })
    );

    // Button Census command
    context.subscriptions.push(
        vscode.commands.registerCommand('autorunpro.census', async () => {
            log('Running Button Census...');
            const config = vscode.workspace.getConfiguration('autorunpro');
            const customTexts = config.get('customButtonTexts', []);
            const censusScript = buildPermissionScript(customTexts, true, null, true, 'census');
            
            let foundAny = false;
            for (const port of CDP_PORTS) {
                try {
                    const pages = await cdpGetPages(port);
                    for (const page of pages) {
                        const result = await cdpEvaluate(page.webSocketDebuggerUrl, censusScript);
                        if (result && result.startsWith('audit-match:')) {
                            const btnText = result.split('|')[0].substring(12);
                            log(`[Census] Port ${port} - Found actionable: "${btnText}"`);
                            foundAny = true;
                        }
                    }
                } catch (e) {}
            }
            if (!foundAny) log('[Census] No actionable buttons found in current targets.');
            vscode.window.showInformationMessage('Button Census complete. Check output log for details.');
        })
    );

    // Open Log File command
    context.subscriptions.push(
        vscode.commands.registerCommand('autorunpro.openLog', async () => {
            try {
                if (!extensionContext) return;
                const logPath = path.join(extensionContext.globalStorageUri.fsPath, 'autorun_pro.log');
                if (!fs.existsSync(logPath)) {
                    vscode.window.showInformationMessage('No log file found yet. Enable the extension to generate logs.');
                    return;
                }
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(logPath));
                await vscode.window.showTextDocument(doc);
            } catch (e) {
                vscode.window.showErrorMessage(`Failed to open log: ${e.message}`);
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
        updateBypassStatusBar();
        log('Extension activated');
    });
}

function deactivate() {
    stopPolling();
    if (outputChannel) outputChannel.dispose();
}

module.exports = { activate, deactivate };
