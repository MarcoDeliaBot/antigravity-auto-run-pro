// AntiGravity AutoAccept v1.8.15 "Strict Button + Preview Exclusion Fix"
// Primary: Persistent CDP WebSocket engine (Zero-Latency Pool)
// Features: Zero-Focus-Theft, Element Tagging, Rich Dashboard, Audit Mode, Audit Persistence
// Fixes v1.8.15: Enforced strict button detection (must be BUTTON or role="button").
//                Excluded command previews and output containers ([class*="command"], 
//                [class*="preview"], .monaco-editor) to prevent false positives.

const vscode = require('vscode');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// ─── VS Code Commands ─────────────────────────────────────────────────
const ACCEPT_COMMANDS = [
    'antigravity.agent.acceptAgentStep',
    'antigravity.terminalCommand.accept',
    'antigravity.terminalCommand.run',
    'antigravity.command.accept',
];

// ─── Webview-Isolated Permission Clicker ──────────────────────────────
const SAFE_TEXTS = [
    'run', 'accept',
    'esegui', 'accetta',
    'continue', 'proceed',
    'continua', 'procedi',
    'always run', 'esegui sempre',
    'allow once', 'consenti una volta',
    'expand', 'espandi',
    'expand all', 'collapse all',
    'espandi tutto', 'comprimi tutto',
    'requires input', 'richiede input',
    'changes overview', 'panoramica modifiche',
];

const UNSAFE_TEXTS = [
    'always allow', 'allow this conversation', 'allow', 'always',
    'consenti sempre', 'consenti in questa conversazione', 'consenti',
];

function buildPermissionScript(customTexts, godMode, standbyButton, auditMode, sessionId, isAgentPage) {
    const allTexts = godMode
        ? [...SAFE_TEXTS, ...UNSAFE_TEXTS, ...customTexts]
        : [...SAFE_TEXTS, ...customTexts];
    return `
(function() {
    var BUTTON_TEXTS = ${JSON.stringify(allTexts)};
    var GOD_MODE = ${godMode ? 'true' : 'false'};
    var STANDBY_BUTTON = ${standbyButton ? JSON.stringify(standbyButton) : 'null'};
    var IS_AGENT_PAGE = ${isAgentPage ? 'true' : 'false'};

    if (!IS_AGENT_PAGE) {
        var panelDetected = (
            document.querySelector('.react-app-container') ||
            document.querySelector('[class*="agent"]') ||
            document.querySelector('[data-vscode-context]') ||
            document.querySelector('.antigravity-agent-side-panel') ||
            document.querySelector('[class*="antigravity"]') ||
            document.querySelector('[class*="chat"]') ||
            document.querySelector('[class*="conversation"]') ||
            document.querySelector('[class*="panel"]')
        );
        if (!panelDetected) {
            var fallbackFound = false;
            function fbWalkShadow(root) {
                var fbWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                var fbNode;
                while ((fbNode = fbWalker.nextNode())) {
                    if (fbNode.shadowRoot) { fbWalkShadow(fbNode.shadowRoot); if (fallbackFound) return; }
                    var fbTag = (fbNode.tagName || '').toLowerCase();
                    if (fbTag === 'button' || fbNode.getAttribute('role') === 'button') {
                        var fbText = (fbNode.textContent || '').trim().toLowerCase();
                        if (fbText === 'run' || fbText.includes('alt+') || fbText.includes('ctrl+') ||
                            fbText === 'accept' || fbText.startsWith('accept ') ||
                            fbText === 'esegui' || fbText.includes('alt+')) {
                            fallbackFound = true;
                            return;
                        }
                    }
                }
            }
            fbWalkShadow(document.body);
            if (!fallbackFound) return 'not-agent-panel';
        }
    }

    var AUDIT_MODE = ${auditMode ? 'true' : 'false'};
    var SESSION_ID = "${sessionId}";

    function getDirectText(node) {
        var text = '';
        for (var i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].nodeType === 3) {
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
    
    function normalizeText(str) {
        return (str || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    }

    function textMatches(nodeText, target) {
        var n = normalizeText(nodeText);
        var t = normalizeText(target);
        if (n === t) return true;
        var nClean = n.replace(/[.\\u2026]+$/, '').trim();
        if (nClean && nClean === t) return true;
        if (nClean.length >= 4 && t.startsWith(nClean)) return true;
        if (n.includes(t) && (n.includes('alt+') || n.includes('ctrl+') || n.includes('cmd+'))) return true;
        if (t === 'accept' && (n === 'accept all' || n.startsWith('accept all'))) return true;
        if (t === 'accetta' && (n === 'accetta tutto' || n.startsWith('accetta tutto'))) return true;
        if ((t === 'expand' || t === 'espandi') && (n === 'expand all' || n === 'espandi tutto' || n.startsWith('expand') || n.startsWith('espandi'))) return true;
        if ((t === 'collapse' || t === 'comprimi') && (n === 'collapse all' || n === 'comprimi tutto' || n.startsWith('collapse') || n.startsWith('comprimi'))) return true;
        if (t.length >= 6 && n.startsWith(t)) return true;
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
            if (GOD_MODE) {
                var testId = (node.getAttribute('data-testid') || node.getAttribute('data-action') || '').toLowerCase();
                if (testId.includes('alwaysallow') || testId.includes('always-allow') || testId.includes('allow')) {
                    var tag1 = (node.tagName || '').toLowerCase();
                    if (tag1 === 'button' || tag1.includes('button') || node.getAttribute('role') === 'button' || tag1.includes('btn')) {
                        return node;
                    }
                }
            }
            var directText = getDirectText(node);
            var fullText = (node.textContent || '').trim().toLowerCase();
            var isExpandTarget = (text === 'expand' || text === 'espandi' ||
                                  text === 'expand all' || text === 'espandi tutto' ||
                                  text === 'collapse' || text === 'comprimi' ||
                                  text === 'collapse all' || text === 'comprimi tutto');
            var checkText = (text.length <= 4 && !isExpandTarget)
                ? (directText || (fullText.length <= 40 ? fullText : ''))
                : (directText || fullText.substring(0, 60));
            
            if (textMatches(checkText, text)) {
                var clickable = closestClickable(node);
                var tag2 = (clickable.tagName || '').toLowerCase();
                var textLower = (clickable.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
                var isExpand = isExpandTarget || textLower.includes('expand') || textLower.includes('espandi') ||
                               textLower.includes('collapse') || textLower.includes('comprimi');
                var isPermission = (text.includes('allow') || text.includes('consenti'));
                
                // FIX v1.8.15: For short targets ('run', 'accept' etc.) require a REAL button element.
                // Focusable containers (tabindex=0, onclick) are too permissive and match
                // chat message bubbles. [class*="message"] exclusion removed — in Antigravity
                // the "Run Alt+Enter" button lives inside the agent message container.
                var isRealButton = (tag2 === 'button' || tag2.includes('button') ||
                                    clickable.getAttribute('role') === 'button' || tag2.includes('btn'));
                var isShortTarget = (text.length <= 6 && !isExpand && !isPermission);
                var passesBtnCheck = isShortTarget
                    ? isRealButton
                    : (isRealButton || clickable.classList.contains('cursor-pointer') ||
                       clickable.onclick || clickable.getAttribute('tabindex') === '0' ||
                       isExpand || isPermission || text === 'requires input' || textLower === 'accept all' || textLower === 'accetta tutto');

                if (passesBtnCheck) {
                    // Exclude VS Code native UI chrome (menu bar, status bar, title bar).
                    // .monaco-editor / terminal containers: source code / terminal output matches excluded.
                    if (node.closest && (node.closest('.monaco-editor') || node.closest('.terminal-wrapper') ||
                        node.closest('.terminal-container') || node.closest('.part.editor') ||
                        node.closest('[class*="command"]') || node.closest('[class*="preview"]') ||
                        node.closest('[class*="output"]') || node.closest('[class*="history"]') ||
                        node.closest('[class*="menubar"]') || node.closest('.monaco-menu') ||
                        node.closest('.statusbar') || node.closest('.titlebar-container') ||
                        node.closest('[aria-label="Application Menu"]'))) {
                        continue;
                    }
                    // Visibility check: only click buttons actually rendered on screen.
                    var rect = clickable.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) continue;
                    return clickable;
                }
            }
        }
        return null;
    }

    function isElementVisible(el) {
        if (!el) return false;
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
        var style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) return false;
        if (el.disabled) return false;
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function isGenerating() {
        var walkers = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        var n;
        var hasStreamingIndicator = false;
        while ((n = walkers.nextNode())) {
            var text = (n.textContent || '').trim().toLowerCase();
            if (n.tagName === 'BUTTON' && (text === 'interrupt' || text === 'stop generating' || text === 'cancel' || text === 'interrompi')) {
                if (isElementVisible(n)) return true;
            }
            if (n.getAttribute('data-testid') === 'interrupt-button' || n.getAttribute('aria-label') === 'Interrupt') {
                if (isElementVisible(n)) return true;
            }
            if (n.classList && (n.classList.contains('streaming') || n.classList.contains('typing-indicator') || n.classList.contains('generating'))) {
                hasStreamingIndicator = true;
            }
        }
        return hasStreamingIndicator;
    }

    var outputData = getAssistantOutput();
    var fingerprint = outputData ? getHashCode(outputData.text) : 'no-output';
    var selectorUsed = outputData ? outputData.selector : 'none';

    var PRIORITY_TEXTS = ['run', 'accept', 'esegui', 'accetta'];
    for (var p0 = 0; p0 < PRIORITY_TEXTS.length; p0++) {
        var p0btn = findButton(document.body, PRIORITY_TEXTS[p0]);
        if (p0btn) {
            if (STANDBY_BUTTON === PRIORITY_TEXTS[p0] || STANDBY_BUTTON === 'priority-' + PRIORITY_TEXTS[p0]) {
                return 'standby-present:' + PRIORITY_TEXTS[p0] + '|' + fingerprint + '|' + selectorUsed;
            }
            if (AUDIT_MODE) return 'audit-match:priority-' + PRIORITY_TEXTS[p0] + '|' + fingerprint;
            var p0r = p0btn.getBoundingClientRect();
            var p0x = Math.round(p0r.left + p0r.width / 2);
            var p0y = Math.round(p0r.top + p0r.height / 2);
            robustClick(p0btn);
            p0btn.setAttribute('data-ag-clicked', fingerprint);
            p0btn.setAttribute('data-ag-session', SESSION_ID);
            return 'need-click:priority-' + PRIORITY_TEXTS[p0] + '|' + p0x + ':' + p0y + '|' + fingerprint + '|' + selectorUsed;
        }
    }

    if (isGenerating()) return 'generating';

    function getHashCode(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    function getAssistantOutput() {
        var selectors = ['[data-testid="assistant-message"]:last-of-type', '.antigravity-message.assistant:last-child', '[class*="assistant-message"]:last-child', '[class*="agent-message"]:last-child', 'div[class*="message"]:last-child'];
        for (var s = 0; s < selectors.length; s++) {
            var el = document.querySelector(selectors[s]);
            if (el && el.textContent.trim().length > 5) {
                return { text: el.textContent.trim(), selector: selectors[s] };
            }
        }
        return null;
    }

    function robustClick(el) {
        var preventer = function(e) { e.stopPropagation(); };
        el.addEventListener('blur', preventer, true);
        try {
            try { el.focus(); } catch(ef) {}
            var rect = el.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var opts = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };
            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            el.click();
        } catch(e) { el.click(); }
        setTimeout(function() { el.removeEventListener('blur', preventer, true); }, 500);
    }

    for (var t = 0; t < BUTTON_TEXTS.length; t++) {
        var btn = findButton(document.body, BUTTON_TEXTS[t]);
        if (btn) {
            if (STANDBY_BUTTON === BUTTON_TEXTS[t] || STANDBY_BUTTON === 'priority-' + BUTTON_TEXTS[t]) {
                return 'standby-present:' + BUTTON_TEXTS[t] + '|' + fingerprint + '|' + selectorUsed;
            }
            var isReClickable = (BUTTON_TEXTS[t] === 'expand' || BUTTON_TEXTS[t] === 'espandi' || BUTTON_TEXTS[t] === 'expand all' || BUTTON_TEXTS[t] === 'espandi tutto' || BUTTON_TEXTS[t] === 'collapse all' || BUTTON_TEXTS[t] === 'comprimi tutto' || BUTTON_TEXTS[t] === 'requires input' || BUTTON_TEXTS[t] === 'richiede input' || BUTTON_TEXTS[t] === 'changes overview' || BUTTON_TEXTS[t] === 'panoramica modifiche' || BUTTON_TEXTS[t].includes('allow') || BUTTON_TEXTS[t].includes('consenti'));
            if (!isReClickable && btn.getAttribute('data-ag-clicked') === fingerprint) return 'already-clicked:' + BUTTON_TEXTS[t];
            if (AUDIT_MODE) return 'audit-match:' + BUTTON_TEXTS[t] + '|' + fingerprint;
            var br = btn.getBoundingClientRect();
            var bx = Math.round(br.left + br.width / 2);
            var by = Math.round(br.top + br.height / 2);
            robustClick(btn);
            btn.setAttribute('data-ag-clicked', fingerprint);
            btn.setAttribute('data-ag-session', SESSION_ID);
            return 'need-click:' + BUTTON_TEXTS[t] + '|' + bx + ':' + by + '|' + fingerprint + '|' + selectorUsed;
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
let totalClicks = 0;
let lastActionTime = 0;
let lastActionText = 'None';
let cdpStatus = 'Disconnected';
let globalCooldownUntil = 0;
let consecutiveClickCount = 0;
let lastClickedButton = null;
let lastAgentFingerprint = '';
let consecutiveFingerprintCount = 0;

let pollIntervalId = null;
let cdpIntervalId = null;
let statusBarItem = null;
let godModeStatusBarItem = null;
let bypassStatusBarItem = null;
let outputChannel = null;
let extensionContext = null;

function log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const fullMsg = `${timestamp} ${msg}`;
    if (outputChannel) outputChannel.appendLine(fullMsg);
    logToFile(fullMsg);
}

const MAX_LOG_SIZE = 1 * 1024 * 1024;
function logToFile(msg) {
    try {
        if (!extensionContext) return;
        const storagePath = extensionContext.globalStorageUri.fsPath;
        if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
        const logPath = path.join(storagePath, 'autorun_pro.log');
        try {
            const stats = fs.statSync(logPath);
            if (stats.size > MAX_LOG_SIZE) {
                const content = fs.readFileSync(logPath, 'utf8');
                const lines = content.split('\n');
                fs.writeFileSync(logPath, '--- LOG ROTATED ---\n' + lines.slice(Math.floor(lines.length/2)).join('\n'), 'utf8');
            }
        } catch (e) {}
        fs.appendFileSync(logPath, msg + '\n', 'utf8');
    } catch (e) {}
}

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
    statusBarItem.tooltip = `Antigravity Auto Run Pro v1.8.15\nMode: ${isEnabled ? (isStandby ? 'STANDBY' : 'ACTIVE') : 'OFF'}\nClicks: ${totalClicks}\nCDP: ${cdpStatus}`;
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

const wsPool = new Map();
let nextCdpId = 1;

function cdpGetPages(port) {
    return new Promise((resolve, reject) => {
        const req = http.get({ hostname: '127.0.0.1', port, path: '/json/list', timeout: 500 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data).filter(p => p.webSocketDebuggerUrl)); } catch (e) { reject(e); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

function cdpEvaluate(wsUrl, expression) {
    return new Promise((resolve) => {
        let ws = wsPool.get(wsUrl);
        if (ws && ws.readyState !== WebSocket.OPEN) { try { ws.close(); } catch(e) {} wsPool.delete(wsUrl); ws = null; }
        if (!ws) {
            ws = new WebSocket(wsUrl);
            wsPool.set(wsUrl, ws);
            ws.on('error', () => wsPool.delete(wsUrl));
            ws.on('close', () => wsPool.delete(wsUrl));
        }
        const callId = nextCdpId++;
        const onMessage = (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.id === callId) { clearTimeout(timeout); ws.removeListener('message', onMessage); resolve(msg.result?.result?.value || ''); }
            } catch (e) { clearTimeout(timeout); ws.removeListener('message', onMessage); resolve(null); }
        };
        const timeout = setTimeout(() => { ws.removeListener('message', onMessage); resolve(null); }, 1500);
        const onFail = () => { clearTimeout(timeout); ws.removeListener('message', onMessage); wsPool.delete(wsUrl); resolve(null); };
        if (ws.readyState === WebSocket.OPEN) {
            ws.on('message', onMessage);
            ws.send(JSON.stringify({ id: callId, method: 'Runtime.evaluate', params: { expression } }));
        } else if (ws.readyState === WebSocket.CONNECTING) {
            ws.once('open', () => { ws.on('message', onMessage); ws.send(JSON.stringify({ id: callId, method: 'Runtime.evaluate', params: { expression } })); });
            ws.once('error', onFail);
            ws.once('close', onFail);
        } else { wsPool.delete(wsUrl); clearTimeout(timeout); resolve(null); }
    });
}

function cdpSend(wsUrl, method, params) {
    return new Promise((resolve) => {
        let ws = wsPool.get(wsUrl);
        if (ws && ws.readyState !== WebSocket.OPEN) { try { ws.close(); } catch(e) {} wsPool.delete(wsUrl); ws = null; }
        if (!ws) { ws = new WebSocket(wsUrl); wsPool.set(wsUrl, ws); ws.on('error', () => wsPool.delete(wsUrl)); ws.on('close', () => wsPool.delete(wsUrl)); }
        const callId = nextCdpId++;
        const onMessage = (data) => { try { const msg = JSON.parse(data.toString()); if (msg.id === callId) { clearTimeout(timeout); ws.removeListener('message', onMessage); resolve(msg.result || null); } } catch(e) { clearTimeout(timeout); ws.removeListener('message', onMessage); resolve(null); } };
        const timeout = setTimeout(() => { ws.removeListener('message', onMessage); resolve(null); }, 1000);
        if (ws.readyState === WebSocket.OPEN) { ws.on('message', onMessage); ws.send(JSON.stringify({ id: callId, method, params: params || {} })); }
        else { resolve(null); }
    });
}

async function cdpNativeClick(wsUrl, x, y) {
    if (!x || !y) return;
    const base = { x, y, button: 'left', clickCount: 1, modifiers: 0, pointerType: 'mouse' };
    await cdpSend(wsUrl, 'Input.dispatchMouseEvent', { ...base, type: 'mousePressed' });
    await cdpSend(wsUrl, 'Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' });
}

const CDP_PORTS = [9333, 9334, 9335, 9336, 9222, 9229, ...Array.from({ length: 10 }, (_, i) => 9000 + i)];
let isCheckingCDP = false;

async function checkPermissionButtons() {
    if (!isEnabled || isCheckingCDP) return;
    isCheckingCDP = true;
    const config = vscode.workspace.getConfiguration('autorunpro');
    const customTexts = config.get('customButtonTexts', []);
    const scriptNormal = buildPermissionScript(customTexts, isGodMode, standbyButton, isAuditMode, currentSessionId, false);
    const scriptAgent = buildPermissionScript(customTexts, isGodMode, standbyButton, isAuditMode, currentSessionId, true);
    
    function isAgentPageUrl(url) {
        if (!url) return false;
        const u = url.toLowerCase();
        return u.startsWith('vscode-webview://') || u.includes('jetski') || u.includes('agent-panel') || u.includes('antigravity');
    }

    try {
        for (const port of CDP_PORTS) {
            try {
                const pages = await cdpGetPages(port);
                if (!pages.length) continue;
                cdpStatus = `Connected (${port})`;
                pages.sort((a,b) => {
                    const isA = isAgentPageUrl(a.url), isB = isAgentPageUrl(b.url);
                    return (isA && !isB) ? -1 : (!isA && isB) ? 1 : 0;
                });
                for (const page of pages) {
                    const script = isAgentPageUrl(page.url) ? scriptAgent : scriptNormal;
                    const result = await cdpEvaluate(page.webSocketDebuggerUrl, script);
                    if (!result) continue;
                    
                    if (result.startsWith('standby-present:')) {
                        if (!isStandby) { isStandby = true; standbyButton = result.split(':')[1].split('|')[0]; log(`[CDP] STANDBY for ${standbyButton}`); }
                        updateStatusBar(); return;
                    }

                    if (result.startsWith('need-click:')) {
                        const parts = result.substring(11).split('|');
                        const btnText = parts[0];
                        const coords = parts[1].split(':');
                        const x = parseInt(coords[0]), y = parseInt(coords[1]);
                        const fingerprint = parts[2];
                        
                        totalClicks++;
                        lastActionText = `Clicked ${btnText}`;
                        if (btnText === lastClickedButton && (Date.now() - lastActionTime) < 10000) consecutiveClickCount++;
                        else consecutiveClickCount = 1;
                        lastClickedButton = btnText;
                        
                        if (fingerprint !== 'no-output' && fingerprint === lastAgentFingerprint) consecutiveFingerprintCount++;
                        else { consecutiveFingerprintCount = 1; lastAgentFingerprint = fingerprint; }
                        lastActionTime = Date.now();
                        
                        if (consecutiveClickCount > (btnText.includes('expand') ? 30 : 15)) { isStandby = true; standbyButton = btnText; log(`[CDP] LOOP: ${btnText}`); }
                        await cdpNativeClick(page.webSocketDebuggerUrl, x, y);
                        updateStatusBar(); return;
                    } else if (result === 'no-permission-button' && isStandby) {
                        isStandby = false; standbyButton = null; log(`[CDP] STANDBY ended.`);
                        updateStatusBar();
                    }
                }
            } catch(e) {}
        }
    } finally { isCheckingCDP = false; }
}

function startPolling() {
    if (isPollingActive) return;
    isPollingActive = true;
    async function runVsCodePolling() {
        if (!isPollingActive || !isEnabled) return;
        if (!isStandby) { await Promise.allSettled(ACCEPT_COMMANDS.map(cmd => vscode.commands.executeCommand(cmd))); }
        setTimeout(runVsCodePolling, 1000);
    }
    async function runCdpPolling() {
        if (!isPollingActive || !isEnabled) return;
        await checkPermissionButtons();
        setTimeout(runCdpPolling, 1500);
    }
    runVsCodePolling(); runCdpPolling();
}

let isPollingActive = false;
function stopPolling() { isPollingActive = false; }

function activate(context) {
    extensionContext = context;
    outputChannel = vscode.window.createOutputChannel('AntiGravity AutoAccept');
    log('Extension activating (v1.8.15 "Strict Button Detection")');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'autorunpro.toggle';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();
    godModeStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    godModeStatusBarItem.command = 'autorunpro.toggleGodMode';
    context.subscriptions.push(godModeStatusBarItem);
    isGodMode = context.globalState.get('autorunproGodMode', false);
    updateGodModeStatusBar();

    context.subscriptions.push(vscode.commands.registerCommand('autorunpro.toggle', () => {
        isEnabled = !isEnabled;
        if (isEnabled) { isStandby = false; startPolling(); } else stopPolling();
        updateStatusBar();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('autorunpro.toggleGodMode', () => {
        isGodMode = !isGodMode; updateGodModeStatusBar(); context.globalState.update('autorunproGodMode', isGodMode);
    }));
    updateStatusBar();
}

function deactivate() { stopPolling(); for (const [u, ws] of wsPool) ws.close(); wsPool.clear(); }

module.exports = { activate, deactivate };
