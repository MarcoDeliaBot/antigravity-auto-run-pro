# Changelog

All notable changes to the **Antigravity Auto Run Pro** extension will be documented in this file.

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
