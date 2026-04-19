# Changelog

All notable changes to the **Antigravity Auto Run Pro** extension will be documented in this file.

## [1.8.15] - 2026-04-19

### Fixed
- **Critical: Command Preview & History Exclusion** — The extension now excludes command previews, history sections, and output containers (`[class*="command"]`, `[class*="preview"]`, `[class*="output"]`, `[class*="history"]`) from button detection. This prevents infinite loops on "run" or "running" text displayed in the chat interface.
- **Strict Button Validation**: Short target texts (like "run") now REQUIRE a native `BUTTON` element or a `role="button"` attribute to be considered valid, further reducing false positives.
- **Visibility Guard**: Added a strict dimension check (`width > 0 && height > 0`) to ensure only rendered buttons are targeted.

## [1.8.14] - 2026-04-19

### Fixed
- **Critical: Editor & Terminal False Positive Protection** — The extension now explicitly excludes the VS Code editor (`.monaco-editor`) and terminal containers (`.terminal-wrapper`, `.terminal-container`) from button detection. This prevents false clicks on text inside your source code or terminal output that happens to match "run" or "accept".
- **Improved Scoping**: Limited the button search scope to avoid matching decorative or structural elements in the main workbench parts.

## [1.8.13] - 2026-04-19

### Fixed
- **Critical: Chat Bubble False Positive Protection** — The extension now explicitly excludes elements inside chat bubbles (`[class*="message"]`, `.antigravity-message`, etc.) from button detection. This prevents infinite loops caused by the agent's conversation history containing the word "run" or command text.
- **Critical: Standby Sync Fix** — Added host-side handling for the `standby-present` message from the CDP script. The extension now correctly maintains the STANDBY state as long as the problematic button remains visible, instead of immediately retrying the click.
- **Robustness**: Strengthened `findButton` logic to better distinguish real action buttons from decorative or structural text elements.

## [1.8.12] - 2026-04-19

### Fixed
- **Critical: CDP Page Prioritization** — The extension now sorts CDP targets to process `vscode-webview://` pages before the main `workbench.html`. This eliminates false positive clicks on "run" labels in the VS Code UI chrome (menu bar, sidebar) that were causing infinite loops and incorrect STANDBY activations.
- **Critical: Standby Sync for Priority Buttons** — Fixed a bug where the `STANDBY_BUTTON` check in the injected script didn't account for the `priority-` prefix used for terminal run/accept buttons. This prevented the extension from correctly identifying when a button was stuck, leading to infinite retry loops.
- **Robust Button Matching** — Improved `textMatches` to handle variations in keyboard shortcut formatting (e.g., "Run (Alt+Enter)" vs "Run Alt+Enter").

## [1.8.11] - 2026-04-19

### Fixed
- **Critical: VS Code menu bar "Run" voice causes false STANDBY** — `findButton` traversed the entire workbench DOM including VS Code's top menu bar (File/Edit/Selection/View/Go/**Run**/Terminal/Help). The `<div class="menubar-menu-button">` with text "run" matched the `'run'` target perfectly, was returned as clickable (it has `tabindex="0"`), and got clicked 15 times → false STANDBY. The actual Antigravity confirmation button (in the bottom bar) was never reached. Fix: added a `node.closest()` check in `findButton` that skips any element whose ancestor has class `*menubar*`, `.monaco-menu`, `*action-bar*`, `.statusbar`, `.titlebar-container`, or `[aria-label="Application Menu"]`.
- **Action-Bar Filtering Fix**: Re-enabled action-bar containers in some contexts as they contain legitimate Antigravity buttons.

## [1.8.9] - 2026-04-19

### Added
- Richer log rotation and management.
- Improved audit mode feedback.
