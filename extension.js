// AntiGravity AutoAccept v1.8.5 "Priority Run Fix"
// Primary: Persistent CDP WebSocket engine (Zero-Latency Pool)
// Features: Zero-Focus-Theft, Element Tagging, Rich Dashboard, Audit Mode, Audit Persistence
// Fixes v1.8.5: fingerprint e selectorUsed ora calcolati PRIMA della PRIORITY_PHASE_0 (erano undefined, causando standby prematuro dopo 15 click)

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
// FIX v1.7.9: Added 'always' standalone — the Antigravity IDE truncates
// "Always allow" to "Always ..." via CSS text-overflow. The ellipsis gets
// stripped by normalizeText, leaving just "always" which must match.
const UNSAFE_TEXTS = [
    'always allow', 'allow this conversation', 'allow', 'always',
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
    
    // ═══ WEBVIEW GUARD (FIX v1.8.3: Multi-layer) ═══
    // Layer 1: Specific Antigravity selectors (fast path)
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
        // Layer 2: Button-presence fallback — if target buttons exist in this webview,
        // we ARE in the right panel regardless of CSS class names.
        // This survives Antigravity DOM updates that change class names.
        var fallbackFound = false;
        var fbWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        var fbNode;
        while ((fbNode = fbWalker.nextNode())) {
            var fbTag = (fbNode.tagName || '').toLowerCase();
            if (fbTag === 'button' || fbNode.getAttribute('role') === 'button') {
                var fbText = (fbNode.textContent || '').trim().toLowerCase();
                if (fbText === 'run' || fbText.startsWith('run alt+') || fbText.startsWith('run ctrl+') ||
                    fbText === 'accept' || fbText.startsWith('accept ') ||
                    fbText === 'esegui' || fbText.startsWith('esegui alt+')) {
                    fallbackFound = true;
                    break;
                }
            }
        }
        if (!fallbackFound) return 'not-agent-panel';
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
        // FIX v1.7.9: Strip trailing ellipsis from truncated UI text.
        // The Antigravity IDE truncates long button labels with CSS text-overflow,
        // producing "Always ..." or "Always…" instead of "Always allow".
        var nClean = n.replace(/[\.\u2026]+$/, '').trim();
        if (nClean && nClean === t) return true;
        // Also: if the cleaned text is a prefix of the target (e.g. "always" matches "always allow")
        if (nClean.length >= 4 && t.startsWith(nClean)) return true;
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
            // FIX v1.8.3: For short targets (≤4 chars like 'run'), if directText is empty
            // (happens when button text is inside a <span> child, not a direct text node),
            // fall back to fullText only when it is short enough to be a button label (≤40 chars).
            // This prevents matching "run" inside long text blocks while still catching
            // <button><span>Run</span> Alt+Enter</button> structures.
            var checkText = (text.length <= 4 && !isExpandTarget)
                ? (directText || (fullText.length <= 40 ? fullText : ''))
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
    // FIX v1.7.9: Added visibility guard — only count VISIBLE, ENABLED stop buttons.
    // The Antigravity IDE keeps a Stop ■ button in the input area at all times.
    // Without the visibility check, isGenerating() returned true during "Waiting.."
    // state, blocking ALL button detection (including Expand).
    function isElementVisible(el) {
        if (!el) return false;
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
        var style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) return false;
        if (el.disabled) return false;
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return true;
    }

    function isGenerating() {
        var walkers = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        var n;
        // FIX v1.7.9: Also check for active streaming indicators (animated dots, spinners)
        var hasStreamingIndicator = false;
        while ((n = walkers.nextNode())) {
            var text = (n.textContent || '').trim().toLowerCase();
            if (n.tagName === 'BUTTON' && (text === 'interrupt' || text === 'stop generating' || text === 'cancel' || text === 'interrompi')) {
                // FIX v1.7.9: Only count if the button is actually visible and enabled
                if (isElementVisible(n)) return true;
            }
            if (n.getAttribute('data-testid') === 'interrupt-button' || n.getAttribute('aria-label') === 'Interrupt') {
                if (isElementVisible(n)) return true;
            }
            // Check for streaming/typing indicators (more reliable than stop button presence)
            if (n.classList && (n.classList.contains('streaming') || n.classList.contains('typing-indicator') ||
                n.classList.contains('generating'))) {
                hasStreamingIndicator = true;
            }
        }
        return hasStreamingIndicator;
    }

    // ═══ FINGERPRINT (calcolato prima di PRIORITY_PHASE_0) ═══
    // FIX v1.8.5: fingerprint e selectorUsed devono essere calcolati PRIMA della fase
    // PRIORITY_PHASE_0, altrimenti il loro valore è undefined (var hoisting senza assegnazione).
    // Con undefined come fingerprint, data-ag-clicked="undefined" veniva scritto ad ogni click,
    // il secondo ciclo trovava fingerprint===lastAgentFingerprint e consecutiveFingerprintCount
    // saliva fino allo STANDBY automatico dopo 15 click, bloccando tutta l'estensione.
    var outputData = getAssistantOutput();
    var fingerprint = outputData ? getHashCode(outputData.text) : 'no-output';
    var selectorUsed = outputData ? outputData.selector : 'none';

    // ═══ PRIORITY PHASE 0: Run / Accept terminal commands (bypass isGenerating) ═══
    // FIX v1.8.4: Terminal command prompts ("Run echo...?", "Accept all") are PAUSE POINTS
    // that appear while the AI may still be streaming the rest of its response.
    // The stop button (visible during streaming) was causing isGenerating()=true, which
    // blocked ALL button detection and left the Run prompt hanging indefinitely.
    // These four texts are checked BEFORE the generating guard — they are always safe to click
    // because they represent explicit user-approval gates, not mid-generation UI noise.
    var PRIORITY_TEXTS = ['run', 'accept', 'esegui', 'accetta'];
    for (var p0 = 0; p0 < PRIORITY_TEXTS.length; p0++) {
        var p0btn = findButton(document.body, PRIORITY_TEXTS[p0]);
        if (p0btn) {
            if (STANDBY_BUTTON === PRIORITY_TEXTS[p0]) {
                return 'standby-present:' + PRIORITY_TEXTS[p0] + '|' + fingerprint + '|' + selectorUsed;
            }
            if (p0btn.getAttribute('data-ag-clicked') !== fingerprint) {
                if (AUDIT_MODE) return 'audit-match:priority-' + PRIORITY_TEXTS[p0] + '|' + fingerprint;
                robustClick(p0btn);
                p0btn.setAttribute('data-ag-clicked', fingerprint);
                p0btn.setAttribute('data-ag-session', SESSION_ID);
                return 'clicked:priority-' + PRIORITY_TEXTS[p0] + '|' + fingerprint + '|' + selectorUsed;
            }
        }
    }

    if (isGenerating()) {
        return 'generating';
    }

    // ═══ SMART EXPAND: "Requires Input" Priority ═══
    // FIX v1.7.9: When "X Steps Requires Input — Expand" is present,
    // click THAT specific Expand, not the generic "Expand all" for Progress Updates.
    // The TreeWalker finds elements in DOM order — "Expand all" often comes BEFORE
    // the step-specific "Expand", causing the extension to toggle Progress Updates
    // instead of revealing the Run/Accept buttons.
    function findRequiresInputExpand() {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        var node;
        while ((node = walker.nextNode())) {
            var fullText = (node.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
            // Match "1 step requires input  expand" or localized variants
            if ((fullText.includes('requires input') || fullText.includes('richiede input')) &&
                (fullText.includes('expand') || fullText.includes('espandi'))) {
                // Check if this is a reasonably-sized container (not document.body)
                var textLen = fullText.length;
                if (textLen > 5 && textLen < 200) {
                    // Found the "Requires Input — Expand" row.
                    // Now find the Expand button within this element.
                    var innerWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
                    var inner;
                    while ((inner = innerWalker.nextNode())) {
                        var innerDirect = getDirectText(inner).toLowerCase();
                        var innerFull = (inner.textContent || '').trim().toLowerCase();
                        if (innerDirect.startsWith('expand') || innerDirect.startsWith('espandi') ||
                            innerFull === 'expand' || innerFull === 'espandi') {
                            return closestClickable(inner);
                        }
                    }
                    // If no inner Expand found, the container itself is clickable
                    return closestClickable(node);
                }
            }
        }
        return null;
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

    // ═══ ROBUST CLICK DISPATCH ═══
    // FIX v1.7.9: Dispatch full pointer/mouse event sequence instead of just .click().
    // React/Preact components in Antigravity IDE may listen to mousedown/pointerdown
    // instead of the click event. A bare .click() misses those handlers.
    function robustClick(el) {
        // Zero Focus Theft: Prevent blur/focus shift during click
        var preventer = function(e) { e.stopPropagation(); };
        el.addEventListener('blur', preventer, true);

        try {
            var rect = el.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };

            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
        } catch(e) {
            // Fallback: bare click if PointerEvent not supported
            el.click();
        }

        setTimeout(function() { el.removeEventListener('blur', preventer, true); }, 500);
    }

    // ═══ PRIORITY PHASE: "Requires Input → Expand" ═══
    // FIX v1.7.9: Before the generic BUTTON_TEXTS loop, check for the specific
    // "X Steps Requires Input — Expand" pattern. This prevents clicking the wrong
    // "Expand all" (Progress Updates) instead of the step-specific "Expand".
    var requiresInputBtn = findRequiresInputExpand();
    if (requiresInputBtn) {
        if (AUDIT_MODE) {
            return 'audit-match:requires-input-expand|' + fingerprint;
        }
        robustClick(requiresInputBtn);
        requiresInputBtn.setAttribute('data-ag-clicked', fingerprint);
        requiresInputBtn.setAttribute('data-ag-session', SESSION_ID);
        return 'clicked:requires-input-expand|' + fingerprint + '|' + selectorUsed;
    }

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

            // FIX v1.7.9: Use robust click dispatch for all buttons
            robustClick(btn);
            btn.setAttribute('data-ag-clicked', fingerprint);
            btn.setAttribute('data-ag-session', SESSION_ID);

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

// Max log file size before rotation (1 MB)
const MAX_LOG_SIZE = 1 * 1024 * 1024;

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

        // Log rotation: if file exceeds MAX_LOG_SIZE, keep only the last half
        try {
            const stats = fs.statSync(logPath);
            if (stats.size > MAX_LOG_SIZE) {
                const content = fs.readFileSync(logPath, 'utf8');
                const lines = content.split('\n');
                const half = Math.floor(lines.length / 2);
                fs.writeFileSync(logPath, '--- LOG ROTATED ---\n' + lines.slice(half).join('\n'), 'utf8');
            }
        } catch (e) { /* file doesn't exist yet, that's fine */ }

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
        `Antigravity Auto Run Pro v1.8.5`,
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
let nextCdpId = 1; // Incremental ID to avoid CDP response collisions

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

        // FIX v1.7.6: Use incremental ID to prevent response collisions on pooled sockets
        const callId = nextCdpId++;

        const onMessage = (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.id === callId) {
                    clearTimeout(timeout);
                    ws.removeListener('message', onMessage);
                    resolve(msg.result?.result?.value || '');
                }
            } catch (e) {
                clearTimeout(timeout);
                ws.removeListener('message', onMessage);
                resolve(null);
            }
        };

        // FIX v1.7.6: Remove listener on timeout to prevent accumulation
        const timeout = setTimeout(() => {
            ws.removeListener('message', onMessage);
            resolve(null);
        }, 1500);

        // FIX v1.7.7: Handle CONNECTING→CLOSED race.
        // If the WebSocket transitions from CONNECTING to CLOSED without ever opening
        // (e.g. connection refused), the 'open' callback never fires. Without an explicit
        // error/close handler on the Promise path, we'd rely solely on the timeout.
        // Adding these handlers ensures faster resolution and prevents stale pool entries.
        const onConnectFail = () => {
            clearTimeout(timeout);
            ws.removeListener('message', onMessage);
            wsPool.delete(wsUrl);
            resolve(null);
        };

        if (ws.readyState === WebSocket.OPEN) {
            ws.on('message', onMessage);
            ws.send(JSON.stringify({ id: callId, method: 'Runtime.evaluate', params: { expression } }));
        } else if (ws.readyState === WebSocket.CONNECTING) {
            ws.once('open', () => {
                ws.removeListener('error', onConnectFail);
                ws.removeListener('close', onConnectFail);
                ws.on('message', onMessage);
                ws.send(JSON.stringify({ id: callId, method: 'Runtime.evaluate', params: { expression } }));
            });
            ws.once('error', onConnectFail);
            ws.once('close', onConnectFail);
        } else {
            // CLOSING or CLOSED — evict and fail fast
            wsPool.delete(wsUrl);
            clearTimeout(timeout);
            resolve(null);
        }
    });
}

// FIX v1.7.8: Dedicated port 9333 first — avoids conflict with Chrome (which often grabs 9222).
// When Chrome steals 9222, Antigravity's --remote-debugging-port=9222 silently fails to bind,
// leaving the IDE without ANY debug port. This was the root cause of the intermittent "stops working".
const ANTIGRAVITY_PORT = 9333;
const CDP_PORTS = [ANTIGRAVITY_PORT, 9222, 9229, ...Array.from({ length: 15 }, (_, i) => 9000 + i)];

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
                                // FIX v1.7.9: added 'requires-input-expand' to high-tolerance set
                                const isHighToleranceBtn = (
                                    btnText === 'expand' || btnText === 'espandi' ||
                                    btnText === 'expand all' || btnText === 'espandi tutto' ||
                                    btnText === 'collapse all' || btnText === 'comprimi tutto' ||
                                    btnText === 'always run' || btnText === 'esegui sempre' ||
                                    btnText === 'requires-input-expand' ||
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
                            return; // FIX v1.7.6: isCheckingCDP released by finally{}
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
        // FIX v1.7.6: ALWAYS release the mutex — prevents permanent CDP polling deadlock
        // Previously isCheckingCDP could remain true if an exception or early return occurred,
        // silently killing all CDP polling until extension restart.
        isCheckingCDP = false;
        // FIX v1.7.3: watchdogTimer is now declared as null above — clearTimeout(null) is a no-op, safe
        clearTimeout(watchdogTimer);
    }
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
    // FIX v1.7.7: Entire body wrapped in try/catch — an unhandled exception must NEVER
    // kill the recursive chain, otherwise polling stops permanently with no recovery.
    async function runVsCodePolling() {
        if (!isPollingActive || !isEnabled) return;
        try {
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

                    results.forEach((res, idx) => {
                        if (res.status === 'rejected') {
                            const errMsg = (res.reason && res.reason.message) ? res.reason.message : String(res.reason);
                            if (!errMsg.toLowerCase().includes('not found') && !errMsg.toLowerCase().includes('not enabled')) {
                                logThrottled(`vs-cmd-${idx}`, `[VSCode API] \u26A0\uFE0F Cmd ${ACCEPT_COMMANDS[idx]} rejected: ${errMsg}`);
                            }
                        }
                    });
                } catch (e) {
                    logThrottled('vs-cmd-fatal', `[VSCode API] \uD83D\uDD34 Fatal polling error: ${(e && e.message) ? e.message : String(e)}`);
                } finally {
                    isAccepting = false;
                }
            }
        } catch (e) {
            logThrottled('vs-poll-crash', `[VSCode API] \uD83D\uDD34 Polling cycle crashed (recovered): ${(e && e.message) ? e.message : String(e)}`);
        }

        // ALWAYS reschedule — even after crash — to keep the loop alive
        if (isPollingActive && isEnabled) {
            const nextDelay = getRandomJitter(baseInterval, 0.3);
            pollIntervalId = setTimeout(runVsCodePolling, nextDelay);
        }
    }

    // CDP permission polling mapping - recursive setTimeout
    // FIX v1.7.7: Entire body wrapped in try/catch — same resilience pattern as VS Code polling.
    async function runCdpPolling() {
        if (!isPollingActive || !isEnabled) return;
        try {
            const now = Date.now();
            if (now >= globalCooldownUntil) {
                await checkPermissionButtons();
            }
            updateBypassStatusBar();
        } catch (e) {
            logThrottled('cdp-poll-crash', `[CDP] \uD83D\uDD34 Polling cycle crashed (recovered): ${(e && e.message) ? e.message : String(e)}`);
        }

        // ALWAYS reschedule — even after crash — to keep the loop alive
        if (isPollingActive && isEnabled) {
            const nextDelay = getRandomJitter(1500, 0.2);
            cdpIntervalId = setTimeout(runCdpPolling, nextDelay);
        }
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

// FIX v1.7.8: Check ANTIGRAVITY_PORT first, then fallback to 9222.
// Detects port conflict (Chrome stealing the port) and warns the user.
function checkAndFixCDP() {
    return new Promise((resolve) => {
        // Try the dedicated Antigravity port first
        tryPort(ANTIGRAVITY_PORT, (ok) => {
            if (ok) {
                log(`[CDP] Debug port active on ${ANTIGRAVITY_PORT} ✓`);
                resolve(true);
                return;
            }
            // Fallback: try legacy port 9222
            tryPort(9222, (ok2, pages) => {
                if (ok2) {
                    // Port 9222 is open — but is it Antigravity or Chrome?
                    const hasAntigravityTarget = pages && pages.some(p => {
                        const url = (p.url || '').toLowerCase();
                        return url.startsWith('vscode-webview://') || url.includes('vscode-file://');
                    });
                    if (hasAntigravityTarget) {
                        log('[CDP] Debug port active on 9222 (Antigravity) ✓');
                        resolve(true);
                    } else {
                        // Port 9222 is open but belongs to Chrome/another browser
                        log('[CDP] ⚠ Port 9222 is occupied by another app (Chrome?). Antigravity needs its own port.');
                        vscode.window.showWarningMessage(
                            '⚡ Port 9222 is used by Chrome — Antigravity needs port ' + ANTIGRAVITY_PORT + '.',
                            'Auto-Fix Shortcut (Windows)',
                            'Manual Guide'
                        ).then(action => {
                            if (action === 'Auto-Fix Shortcut (Windows)') {
                                applyPermanentWindowsPatch();
                            } else if (action === 'Manual Guide') {
                                vscode.env.openExternal(vscode.Uri.parse('https://github.com/MarcoDeliaBot/antigravity-auto-run-pro#readme'));
                            }
                        });
                        resolve(false);
                    }
                } else {
                    log('[CDP] ⚠ No debug port found — remote debugging not enabled');
                    // FIX v1.8.1: show popup only on first call, subsequent retries only log
                    if (!checkAndFixCDP._notifiedOnce) {
                        checkAndFixCDP._notifiedOnce = true;
                        vscode.window.showErrorMessage(
                            '⚡ AutoAccept needs Debug Mode. No debug port found on ' + ANTIGRAVITY_PORT + ' or 9222.',
                            'Auto-Fix Shortcut (Windows)',
                            'Manual Guide'
                        ).then(action => {
                            if (action === 'Auto-Fix Shortcut (Windows)') {
                                applyPermanentWindowsPatch();
                            } else if (action === 'Manual Guide') {
                                vscode.env.openExternal(vscode.Uri.parse('https://github.com/MarcoDeliaBot/antigravity-auto-run-pro#readme'));
                            }
                        });
                    }
                    resolve(false);
                }
            });
        });
    });
}

function tryPort(port, callback) {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/json/list', timeout: 2000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try { callback(true, JSON.parse(data)); }
            catch (e) { callback(true, []); }
        });
    });
    req.on('error', () => callback(false, null));
    req.on('timeout', () => { req.destroy(); callback(false, null); });
}

function applyPermanentWindowsPatch() {
    if (process.platform !== 'win32') {
        vscode.window.showInformationMessage('Auto-patching is Windows-only. Use the Manual Guide.');
        return;
    }

    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    // FIX v1.7.8: Use dedicated port 9333 to avoid Chrome conflict.
    // Also migrates shortcuts still using the old port 9222.
    const psFile = path.join(os.tmpdir(), 'antigravity_patch_shortcut.ps1');
    const psContent = `
$newFlag = "--remote-debugging-port=${ANTIGRAVITY_PORT}"
$oldPattern = "--remote-debugging-port=*"
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
                $args = $shortcut.Arguments
                if ($args -like "*remote-debugging-port=*") {
                    # Migrate: replace old port with new dedicated port
                    $args = $args -replace '--remote-debugging-port=\\d+', $newFlag
                    $shortcut.Arguments = $args
                    $shortcut.Save()
                    $patched = $true
                    Write-Output "MIGRATED: $($file.FullName)"
                } else {
                    # New: add the flag
                    $shortcut.Arguments = ($args + " " + $newFlag).Trim()
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
                `No Antigravity shortcut found on Desktop or Start Menu. Add --remote-debugging-port=${ANTIGRAVITY_PORT} to your shortcut manually.`
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
    log('Extension activating (v1.8.5 "Priority Run Fix")');

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
    // FIX v1.8.0: restore Audit Mode state across restarts
    isAuditMode = context.globalState.get('autorunproAuditMode', false);
    updateGodModeStatusBar();

    context.subscriptions.push(
        vscode.commands.registerCommand('autorunpro.toggle', () => {
            isEnabled = !isEnabled;
            log(`Toggled: ${isEnabled ? 'ON' : 'OFF'}`);
            if (isEnabled) {
                isStandby = false;
                standbyButton = null;
                consecutiveClickCount = 0;
                // FIX v1.8.1: Run CDP check lazily on first toggle-ON (covers the case where
                // extension was OFF at startup and cdpStartupCheck was skipped).
                if (!checkAndFixCDP._notifiedOnce) {
                    cdpRetryCount = 0;
                    cdpStartupCheck();
                }
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
            // FIX v1.8.0: persist Audit Mode across restarts
            context.globalState.update('autorunproAuditMode', isAuditMode);
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

    // FIX v1.7.7: Retry CDP check at startup with backoff.
    // The IDE's debug port may not be ready yet when the extension activates
    // (especially after reload or slow startup). Without retry, the extension
    // silently stays dead until manual toggle — the #1 reported "doesn't work" scenario.
    // FIX v1.8.1: Skip CDP startup check entirely if the extension was disabled in the
    // last session — no point showing a "no debug port" error to a user who hasn't
    // enabled the extension yet. The check runs lazily on first toggle-ON instead.
    const CDP_MAX_RETRIES = 5;
    const CDP_RETRY_BASE_MS = 3000;
    let cdpRetryCount = 0;
    // Reset notification flag for this session
    checkAndFixCDP._notifiedOnce = false;

    function cdpStartupCheck() {
        checkAndFixCDP().then(cdpOk => {
            if (cdpOk) {
                // Restore saved state
                if (context.globalState.get('autorunproEnabled', false)) {
                    isEnabled = true;
                    startPolling();
                }
                updateStatusBar();
                updateBypassStatusBar();
                log('Extension activated (CDP ready)');
            } else if (cdpRetryCount < CDP_MAX_RETRIES) {
                cdpRetryCount++;
                const delay = CDP_RETRY_BASE_MS * cdpRetryCount;
                log(`[CDP] Not ready — retry ${cdpRetryCount}/${CDP_MAX_RETRIES} in ${delay}ms`);
                setTimeout(cdpStartupCheck, delay);
            } else {
                log('[CDP] Not available after retries — manual toggle or restart required');
                updateStatusBar();
                updateBypassStatusBar();
            }
        });
    }

    // FIX v1.8.1: Only run the startup CDP check if the extension was previously enabled.
    // If it was OFF, we skip the check (and the annoying error popup) entirely.
    // The check will happen automatically the first time the user toggles it ON.
    const wasEnabled = context.globalState.get('autorunproEnabled', false);
    if (wasEnabled) {
        cdpStartupCheck();
    } else {
        log('Extension activated (CDP check deferred — extension was OFF)');
        updateStatusBar();
        updateBypassStatusBar();
    }
}

function deactivate() {
    stopPolling();
    // FIX v1.7.6: Close all pooled WebSocket connections to prevent leak on reload/deactivation
    for (const [url, ws] of wsPool) {
        try { ws.close(); } catch(e) {}
    }
    wsPool.clear();
    if (outputChannel) outputChannel.dispose();
}

module.exports = { activate, deactivate };
