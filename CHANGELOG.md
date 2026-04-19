# Changelog

All notable changes to the **Antigravity Auto Run Pro** extension will be documented in this file.

## [1.8.4] - 2026-04-19

### Fixed
- **Critical: Run/Accept buttons bypass `isGenerating()` guard** — When Antigravity IDE shows a terminal command prompt ("Run echo...?"), the AI stop button is still visible while it finishes streaming the rest of the response. This caused `isGenerating()` to return `true`, blocking ALL button detection and leaving the Run prompt hanging. `run`, `accept`, `esegui`, and `accetta` buttons are now checked in a dedicated **Priority Phase 0** that runs BEFORE the generating guard — they represent explicit user-approval gates, not mid-generation UI noise.

## [1.8.3] - 2026-04-19

### Fixed
- **Webview Guard: Multi-layer detection** — The guard that determines whether the CDP script is running inside the Antigravity agent panel was too strict. It required specific CSS class names (`.react-app-container`, `[class*="antigravity"]`, etc.) which break silently when the Antigravity IDE updates its DOM structure. The guard now has two layers: (1) existing specific selectors as fast path, (2) button-presence fallback that detects actual "Run"/"Accept"/"Esegui" buttons in the webview — making the extension immune to CSS class renames in future IDE versions.
- **`getDirectText` fallback for `<span>`-wrapped button text** — For short targets like `'run'` (≤4 chars), the extension only inspected direct text nodes of an element, skipping text nested inside child `<span>` elements. If the button is structured as `<button><span>Run</span> Alt+Enter</button>`, `getDirectText(button)` returned an empty string and no match was found. Now falls back to `fullText` when it is short enough (≤40 chars) to safely represent a button label, without risking false positives on longer text blocks.

## [1.8.2] - 2026-04-12

### Changed
- **Changelog Translation**: Translated all previous Italian changelog entries into English to maintain standard open-source conventions and comply with language requirements for code documentation.

## [1.8.1] - 2026-04-03

### Verified
- **Full Test Suite**: Executed the complete verification test (7 steps) as defined in `test_prompt.md`. Confirmed the automation of clicks on "Run", "Accept", and "Expand" buttons on Windows 11 with PowerShell 5.1.

### Fixed
- **Repeated CDP error popup on startup**: The message "AutoAccept needs Debug Mode. No debug port found on 9333 or 9222" was shown on every retry (up to 5 times in 45 seconds). Now the popup appears **only once** — subsequent retries are only recorded in the log.
- **Invasive CDP check with extension disabled**: The extension performed the debug port check on startup even if the user left the auto-run OFF. Now the check is skipped on startup if the extension was disabled in the last session, and lazily executed on the first toggle-ON.

## [1.8.0] - 2026-04-03

### Fixed
- **Wrong port in manual message**: The warning message shown when no Antigravity shortcut is found indicated `--remote-debugging-port=9222` instead of the correct dedicated port `9333` (introduced in v1.7.8). The user was guided to configure the wrong port.
- **Wrong GitHub link**: The "Manual Guide" buttons in the CDP error dialogs pointed to the `yazanbaker94/AntiGravity-AutoAccept` repository (third-party repo). Corrected to point to `MarcoDeliaBot/antigravity-auto-run-pro#readme`.
- **Audit Mode not persisting**: Toggling the Audit Mode was not saved in `globalState`, so it reset on every extension restart. Now it persists just like `isGodMode` and `isEnabled`.

### Changed
- **Expanded `.vscodeignore`**: Added wildcards to exclude all debug and test files (`cdp_*.js`, `cdp_*.json`, `debug_*.js`, `test_*.js`, `test_*.html`, `test_*.md`, `shadow_findings.json`) from the published `.vsix` package. The 1.1 MB `cdp_full_dom_dump.json` file is no longer included.

## [1.7.9] - 2026-03-26

### Fixed
- **Critical: Smart Expand Targeting** — Root cause of the "stuck on Expand" issue. When the UI shows both "Progress Updates — Expand all" and "1 Step Requires Input — Expand", the TreeWalker found the first `Expand all` in the DOM (for Progress Updates) and clicked that instead of the specific `Expand` for the step requiring input. Added a prioritized `findRequiresInputExpand()` phase that locates the "requires input" element and clicks ONLY the Expand within that section.
- **Critical: isGenerating() False Positive** — The Stop ■ button in the Antigravity IDE input bar is always present in the DOM (even during the "Waiting.." state). `isGenerating()` detected it and returned `true`, blocking ALL button detection. Added visibility checks (`offsetParent`, `display`, `visibility`, `opacity`, `disabled`, `getBoundingClientRect`) — only visible and active stop buttons now trigger the guard.
- **Robust Click Dispatch** — Replaced simple `btn.click()` with full `pointerdown → mousedown → pointerup → mouseup → click` sequence with real coordinates (`getBoundingClientRect`). React/Preact components in the Antigravity IDE might intercept `mousedown`/`pointerdown` instead of `click`, causing silently ignored clicks.

## [1.7.8] - 2026-03-25

### Fixed
- **Critical: Chrome Port Conflict** — Root cause of the intermittent "stops working" issue. Chrome (or other browsers) could occupy port 9222, preventing the Antigravity IDE from binding its debug port. The extension found Chrome targets instead of the agent webviews, resulting in "CDP Status: Disconnected" and zero clicks.
- **Dedicated Port 9333**: The extension now uses port 9333 as its primary port, dedicated exclusively to Antigravity. Port 9222 remains as a fallback but with conflict detection.
- **Port Conflict Detection**: `checkAndFixCDP()` now verifies if port 9222 is occupied by Chrome (analyzing target URLs: `vscode-webview://` = Antigravity, `http://` = Chrome) and shows a specific warning with an auto-fix option.
- **Shortcut Migration**: The Windows patcher now automatically migrates shortcuts from the old port 9222 to the new 9333, without duplicating the flag.

## [1.7.7] - 2026-03-25

### Fixed
- **Critical: Immortal Polling Loops** (`runVsCodePolling`, `runCdpPolling`): Both recursive polling loops are now wrapped in an outer try/catch. Previously, any unhandled exception (e.g. error reading config, unexpected crash in `checkPermissionButtons`) silently killed the `setTimeout` chain — polling stopped forever but the status bar still showed "Auto: ON". **This was the main cause of the "stops working for no reason" issue.**
- **CDP Startup Retry** (`cdpStartupCheck`): The extension now retries the CDP connection up to 5 times with increasing backoff (3s, 6s, 9s, 12s, 15s) at startup. Previously, if the debug port was not ready upon activation (IDE loading, slow reload), the extension remained dead until manually toggled.
- **WebSocket CONNECTING→CLOSED Race** (`cdpEvaluate`): Added explicit handling for WebSockets failing during the CONNECTING phase without ever reaching OPEN. The `once('error')`/`once('close')` handler on the Promise path immediately resolves with `null` and cleans the pool, instead of waiting for the 1500ms timeout.

### Removed
- **Dead Code Cleanup**: Removed `cdpSendMulti()` and `clickBannerViaDom()` functions (~120 lines) that were unused in the active codebase. These functions created non-pooled WebSockets that could conflict with the main pool (CDP allows only one connection per target).

## [1.7.6] - 2026-03-23

### Fixed
- **Critical: CDP Mutex Deadlock Fix** (`isCheckingCDP`): Moved the mutex guard release to the `finally{}` block. Previously, if `cdpEvaluate()` timed out or an early `return` was executed, `isCheckingCDP` remained `true` forever — silently blocking all CDP polling until the extension restarted. **This was a major cause of the intermittent "stops working" issue.**
- **WebSocket Listener Leak**: Added `removeListener('message')` in the `cdpEvaluate()` timeout. Previously, unremoved listeners accumulated on each failed call, causing progressive slowdown and mixed responses.
- **CDP Response Collision**: Replaced the hardcoded ID `1` with an incremental counter (`nextCdpId++`) for `Runtime.evaluate` calls. With the WebSocket pool, two calls on the same connection could mix up responses.
- **WebSocket Orphan Leak**: Added `ws.close()` in the `error` handlers for `clickBannerViaDom()` and `cdpSendMulti()` to close orphaned connections in case of error.
- **Deactivation Cleanup**: The `deactivate()` function now closes all WebSocket connections in the pool and clears the Map, preventing post-reload leaks.
- **Log Rotation**: Implemented automatic log file rotation when exceeding 1 MB, preventing infinite growth on disk.

## [1.7.5] - 2026-03-14

### Fixed
- **Permission Prompt Loop Fix**: Fixed an issue where permission prompts (such as "Allow Once" for folder access) stopped being clicked after the first failed attempt. These buttons are now exempt from anti-duplicate tagging and will be clicked again until the prompt disappears.

## [1.7.4] - 2026-03-14

### Fixed
- **Expand Button Stuck on "Waiting.."**: Fixed a critical bug where the "Expand" button in the "1 Step Requires Input" bar was not clicked because the anti-duplicate tagging mechanism (`data-ag-clicked`) blocked it when the AI output fingerprint didn't change. Expand, collapse, requires input, and changes overview buttons are now exempt from tagging and can be freely re-clicked.
- **Anchor Tag Detection**: Improved `closestClickable` to recognize `<a>` elements as clickable targets, covering alternative DOM structures of the Gemini UI.

## [1.7.3] - 2026-03-14

### Fixed
- **CDP Stability**: Fixed critical `cdpAttempted` and `watchdogTimer` (ReferenceError) bugs that caused silent crashes of the polling loop.
- **Enhanced Expansion**: Added full support for "Expand all", "Collapse all", and their Italian variants in the agent interface.
- **Robust Text Matching**: Implemented text normalization to handle nested SVG icons and multiple spaces inside buttons.
- **Anti-Loop Calibration**: Updated tolerance thresholds for the new expansion buttons to prevent erroneous Standby mode activations.

## [1.7.2] - 2026-03-14

### Added
- **Overtaker Mode**: Implemented a persistent WebSocket pool (Caching) to eliminate CDP handshake latency.
- **Proactive Auto-Click**: Added support for the "Changes Overview" button, eliminating a known manual stall point in the IDE.

## [1.7.1] - 2026-03-14
- **Zero-Focus-Theft**: Native focus event protection to prevent VS Code from interfering during automation.
- **Button Tagging**: Implemented DOM element tagging (`data-ag-clicked`) to prevent duplicate clicks with surgical precision.
- **Rich Dashboard**: The StatusBar tooltip now displays real-time statistics, CDP connection status, and action history.
- **Audit Mode**: New "Dry-run" mode to test automation without executing real clicks (Toggle via `autorunpro.toggleAudit`).
- **Button Census**: New diagnostic command to list all clickable buttons found in the Agent panel.

## [1.6.9] - 2026-03-14

## [1.6.7] - 2026-03-13

### Fixed
- **Anti-Loop Optimization (Always Run)**: Increased the tolerance threshold for the "Always Run" and "Esegui sempre" buttons to 30 clicks (same as the Expand button), reducing false positive standbys during repetitive operations.
- **Diagnostics**: Fixed the version string reported in diagnostic logs.

## [1.6.6] - 2026-03-11

### Fixed
- **Anti-Loop Optimization (Expand/Espandi)**: Drastically increased the tolerance thresholds for interface expansion buttons. Previously, the system could incorrectly enter STANDBY because clicking "Expand" didn't change the message content (fingerprint), being mistaken for a loop. Now these buttons have much higher dedicated thresholds.

---

## [1.6.5] - 2026-03-11

### Fixed
- **Anti-Loop Dynamics**: Fixed the bug where standby was unfairly activated during a series of rapid but valid operations. Now counters are reset instantly with every new AI output.
- **High Tolerance**: Further increased detection thresholds (15 clicks / 10 fingerprints) to ensure maximum fluidity.

---

## [1.6.4] - 2026-03-11

---

## [1.6.3] - 2026-03-11

### Fixed
- Fixed a bug where the `Expand` and `Requires input` buttons in the Agent Manager were not auto-clicked because they were correctly parsed in the script logic but missing from the `SAFE_TEXTS` array that drives the search iterations.
- Clarified that `Allow this conversation` prompts correctly require the **God Mode** (`Ctrl+Alt+Shift+G`) to be enabled as they authorize directory access.

---

## [1.6.2] - 2026-03-11
### Added
- Added English feedback and support section in README.md

---

## [1.6.1] - 2026-03-11

### Fixed
- **Deterministic Hash (Robust Loop Detection)**: Replaced partial text comparison with a deterministic hashing function (`djb2`) to identify repeated AI output with pinpoint accuracy.
- **Real Exponential Backoff**: The post-click wait system now follows a real exponential progression (3s, 6s, 12s, 24s... up to 60s) instead of linear, providing a much more effective brake in case of loops.
- **UI Selectors with Fallback Chain**: Introduced a chain of multiple DOM selectors to locate the assistant's output, making the extension resilient to future Antigravity interface changes.
- **Advanced Metadata Logging**: Logs now include the output fingerprint, the achieved backoff level, and the successfully used DOM selector.

---

## [1.6.0] - 2026-03-11

### Added
- **Kill Switch / Lockdown Mode**: The extension automatically disables itself if it detects an abnormal peak of operations (e.g. > 20 clicks in 2 minutes) to prevent bans from external APIs.
- **Debouncing and Progressive Cooldown (Exponential Backoff)**: Every critical action instigates a time block. In case of loops on repeated errors, the wait time between one click and the next progressively increases (+2 seconds at each continuous iteration).
- **AI Output Loop Detection (Hash check)**: The extension now extracts a fragment of the text generated by the Agent (AI output snippet). If the Agent is in a logical loop and proposes the same flawed solution more than 3 times, automation halts the chat in Standby before exhausting the account.
- **Advanced Diagnostic Logging**: Includes retry counts and expected cooldowns inside `autorun_pro.log` to simplify debugging.

---

## [1.5.9] - 2026-03-11

### Added
- Introduced UI state checking: the extension now verifies if the agent is actively generating text ("generating") and prevents click loops during that phase.
- Randomized (Jitter) polling intervals (random `setTimeout` instead of fixed `setInterval`) to evade anti-bot detection mechanisms and avoid account blocks.

---

## [1.5.8] - 2026-03-09

### Changed
- Executed extension test confirming correct functionality (auto-accept for files and auto-run for terminal).
- Updated internal test file (`test_auto_accept.txt`).

---

## [1.5.7] - 2026-03-04

### Added
- Introduced the `AntiGravity Auto Run Pro: Open Log File` command to open the log file in VS Code.
- Added a 10-second Watchdog timer to restore CDP polling in case of anomalous timeout/block of WebSocket communication with the browser.
- Added `autorunpro.openLog` command contribution in `package.json`.

### Changed
- Improved logging system: the log file is now saved centrally in the extension's `globalStorage` (no longer polluting the home or current workspace).

---

## [1.5.6] - 2026-03-03

### Fixed
- Fixed bug in the CDP scanning cycle: the extension now correctly analyzes all open webview pages instead of stopping at the first one (resolved the failure to recognize "Accept all" in the chat panel).
- Improved recognition of the `Accept all` button for file modifications in Chat Edits (recognition of isolated spans).
- Updated internal version strings for consistency.

### Added
- Introduced file logging (`autorun_pro.log`) to facilitate troubleshooting without having to open the VS Code output channel.

---

## [1.5.5] - 2026-03-02
### Changed
- Replaced automatic deactivation for infinite loops with **STANDBY** mode: if a loop is detected, the extension pauses (showing the 🕒 icon on the status bar) until the stuck button disappears from the interface (e.g. when the user writes a new prompt in the panel), then automatically resuming execution.

---

## [1.5.4] - 2026-03-02

### Added
- Made the anti-loop protection introduced in the previous version optional via the `autorunpro.antiLoopProtection` setting (active by default).

---

## [1.5.3] - 2026-03-02

### Added
- Added protection against infinite loops for CDP buttons: if a button is cyclically pressed without success, the extension deactivates itself after 5 consecutive close attempts.

---

## [1.5.2] - 2026-03-02

### Added
- Added explanatory screenshots to Wiki pages to facilitate technical understanding.

---

## [1.5.1] - 2026-03-01

### Added
- Support for pre-release versions (updated `engines.vscode` to `^1.63.0`).

---

## [1.5.0] - 2026-03-01

### Added
- **Agent Manager support**: the Webview Guard now recognizes `.antigravity-agent-side-panel` and `[class*="antigravity"]`, enabling auto-click on buttons inside the Agent Manager side panel (used in Antigravity v1.107+).
- Added **"Always run"** and **"Esegui sempre"** to `SAFE_TEXTS` for the persistent auto-run button in the Agent Manager.

### Fixed
- CDP permission clicker was blocked on current Antigravity versions because `.react-app-container` no longer exists in the DOM. The guard now passes when any Antigravity-specific class is detected.

---

## [1.4.2] - 2026-02-26

### Added
- Added advanced error logging (with anti-spam/throttling) to diagnose missed CDP clicks and rejected VS Code commands

---

## [1.4.1] - 2026-02-26

### Added
- Added **"Allow Once"** and **"Consenti una volta"** to `SAFE_TEXTS`, enabling auto-accept of browser domain permission prompts (e.g. "Agent needs permission to act on example.com") without requiring God Mode.

### Fixed
- Browser domain permission prompts were previously not auto-accepted at all (the "Allow Once" text was missing from all button lists).

---

## [1.4.0] - 2026-02-24

### Added
- **God Mode**: new optional mode (disabled by default) that also auto-accepts parent folder access prompts (Allow, Always Allow, Consenti). Toggle via status bar icon, command palette (`Toggle God Mode`), or `Ctrl+Alt+Shift+G`.
- Dedicated status bar indicator: `$(flame) GOD` (red) when active, `$(shield) Safe` when off.
- New setting `autorunpro.godMode` in VS Code settings.
- Formal `contributes.configuration` section in `package.json` for `godMode`, `pollInterval`, and `customButtonTexts`.

### Changed
- CDP permission script now separates button texts into **safe** (run/accept) and **unsafe** (allow/consenti). Unsafe texts are only matched when God Mode is enabled.
- `data-testid` checks for `allow`/`alwaysallow` are now conditional on God Mode.

## [1.3.1] - 2026-02-21

### Changed
- Added missing SEO keywords to `package.json` and `README.md` to ensure correct indexing on the VS Marketplace and Open VSX ("auto run command", "auto pilot", "auto accept", "free auto accept agent").

## [1.3.0] - 2026-02-21

### Fixed
- Critical fix: CDP button matching now uses **direct text** instead of full `textContent` to prevent false positives. Previously, "run" would match the IDE's "Run" menu, extension names like "Test Runner for Java", and other unrelated elements.
- Added strict `textMatches()` function that only allows exact matches or known suffixed patterns (e.g. "Run Alt+D", "Accept All").
- Short button texts (≤4 chars like "run") now only match on direct text nodes, not descendant text.

### Changed
- Completely rewritten `cdp_debug.js` with cleaner output, agent-panel filtering, and structured button reporting.

## [1.2.2] - 2026-02-21

### Changed
- Major SEO update for the Visual Studio Marketplace. Added keywords and completely rewrote the README.md to ensure the exact phrase "Antigravity Auto Run Pro" and related terms are indexed correctly by search engines.

## [1.2.1] - 2026-02-21

### Changed
- Updated the extension logo with a new minimal, light-themed design.

## [1.2.0] - 2026-02-21

### Added
- Added native support for localized Italian texts ("Esegui", "Accetta", "Consenti", etc.) for the CDP module, to automatically recognize permission prompts on localized IDE versions.

## [1.0.0] - 2026-02-21

### Added
- Initial release of the Pro version, completely rebuilt from scratch.
- New isolated bundle and command structure to prevent collisions.
- Integrates all new accept commands for Antigravity IDE v1.18.4+ (`antigravity.terminalCommand.run`, `antigravity.terminalCommand.accept`, etc.).
- Premium responsive status bar icon and brand new neon lock logo.
