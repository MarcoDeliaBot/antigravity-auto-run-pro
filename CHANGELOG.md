# Changelog

All notable changes to the **Antigravity Auto Run Pro** extension will be documented in this file.

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
