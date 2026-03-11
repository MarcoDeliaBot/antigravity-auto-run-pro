## [1.6.6] - 2026-03-11

### Fixed
- **Anti-Loop Optimization (Expand/Espandi)**: Aumentate drasticamente le soglie di tolleranza per i pulsanti di espansione dell'interfaccia. Precedentemente, il sistema poteva entrare in STANDBY erroneamente perché il click su "Expand" non cambiava il contenuto del messaggio (fingerprint), venendo scambiato per un loop. Ora questi pulsanti hanno soglie dedicate molto più alte.

---

## [1.6.5] - 2026-03-11

### Fixed
- **Anti-Loop Dynamics**: Corretto il bug dove lo standby si attivava ingiustamente durante una serie di operazioni rapide ma valide. Ora i contatori vengono resettati istantaneamente ad ogni nuovo output dell'AI.
- **Tolleranza elevata**: Aumentate ulteriormente le soglie di rilevamento (15 click / 10 fingerprint) per garantire la massima fluidità.

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
- **Hash Deterministico (Robust Loop Detection)**: Sostituito il confronto parziale del testo con una funzione di hashing deterministica (`djb2`) per identificare con precisione millimetrica l'output ripetuto dell'AI.
- **Exponential Backoff Reale**: Il sistema di attesa dopo i click ora segue una progressione esponenziale reale (3s, 6s, 12s, 24s... fino a 60s) invece che lineare, garantendo un freno molto più efficace in caso di loop.
- **Selettori UI con Fallback Chain**: Introdotta una catena di selettori DOM multipli per individuare l'output dell'assistente, rendendo l'estensione resiliente ai futuri cambiamenti dell'interfaccia di Antigravity.
- **Logging Metadati Avanzato**: I log ora includono il fingerprint dell'output, il livello di backoff raggiunto e il selettore DOM utilizzato con successo.

---

## [1.6.0] - 2026-03-11

### Added
- **Kill Switch / Lockdown Mode**: L'estensione si disabilita automaticamente se rileva un picco anomalo di operazioni (es. > 20 click in 2 minuti) per prevenire ban da parte delle API esterne.
- **Debouncing e Cooldown Progressivo (Exponential Backoff)**: Ogni azione critica instaura un blocco temporale. In caso di loop su errori ripetuti, il tempo di attesa tra un click e l'altro aumenta progressivamente (+2 secondi a ogni iterazione continua).
- **Rilevamento Loop dell'Output AI (Hash check)**: Ora l'estensione estrae un frammento del testo generato dall'Agente (AI output snippet). Se l'Agente è in loop logico e propone la stessa soluzione errata per più di 3 volte, l'automazione blocca la chat in Standby prima di esaurire l'account.
- **Logging Diagnostico Avanzato**: Inclusione del conteggio retry e cooldown previsti all'interno di `autorun_pro.log` per semplificare il debug.

---

## [1.5.9] - 2026-03-11

### Added
- Introduzione del controllo dello stato UI: l'estensione ora verifica se l'agente sta attivamente generando testo ("generating") ed evita i loop di click in quella fase.
- Randomizzazione (Jitter) degli intervalli di polling (`setTimeout` casuali invece di `setInterval` fissi) per eludere meccanismi di rilevazione anti-bot ed evitare i blocchi account.

---

## [1.5.8] - 2026-03-09

### Changed
- Eseguito test dell'estensione confermando il corretto funzionamento (auto-accept per file e auto-run per terminale).
- Aggiornato file di test interno (`test_auto_accept.txt`).

---

## [1.5.7] - 2026-03-04

### Added
- Introduzione del comando `AntiGravity Auto Run Pro: Open Log File` per aprire il file di log in VS Code.
- Aggiunto timer Watchdog di 10 secondi per ripristinare il polling CDP in caso di timeout/blocco anomalo della comunicazione WebSocket col browser.
- Aggiunto contributo comando `autorunpro.openLog` in `package.json`.

### Changed
- Migliorato il sistema di logging: ora il file log viene salvato centralmente nella `globalStorage` dell'estensione (non più inquinando la home o il workspace corrente).

---

## [1.5.6] - 2026-03-03

### Fixed
- Corretto bug nel ciclo di scansione CDP: ora l'estensione analizza correttamente tutte le pagine webview aperte invece di fermarsi alla prima (risolto il problema del mancato riconoscimento di "Accept all" nel pannello chat).
- Migliorato il riconoscimento del bottone `Accept all` per le modifiche ai file nei Chat Edits (riconoscimento di span isolati).
- Aggiornate le stringhe di versione interne per coerenza.

### Added
- Introdotto il logging su file (`autorun_pro.log`) per facilitare la diagnosi dei problemi senza dover aprire il canale di output di VS Code.

---

## [1.5.5] - 2026-03-02
### Changed
- Sostituita la disattivazione automatica per i loop infiniti con la modalità **STANDBY**: se viene rilevato un loop, l'estensione si mette in pausa (mostrando l'icona 🕒 sulla barra di stato) finché il pulsante bloccato non scompare dall'interfaccia (es. quando l'utente scrive un nuovo prompt nel pannello), riprendendo poi l'esecuzione automaticamente.

---

## [1.5.4] - 2026-03-02

### Added
- Resa opzionale la protezione anti-loop introdotta nella versione precedente tramite l'impostazione `autorunpro.antiLoopProtection` (attiva di default).

---

## [1.5.3] - 2026-03-02

### Added
- Aggiunta protezione contro i loop infiniti per i pulsanti CDP: se un pulsante viene ciclicamente premuto senza successo, l'estensione si disattiva da sola dopo 5 tentativi consecutivi ravvicinati.

---

## [1.5.2] - 2026-03-02

### Added
- Aggiunti screenshot esplicativi alle pagine della Wiki per facilitarne la comprensione tecnica.

---

## [1.5.1] - 2026-03-01

### Added
- Supporto per le versioni pre-release (aggiornato `engines.vscode` a `^1.63.0`).

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
- Aggiunto logging avanzato degli errori (con anti-spam/throttling) per diagnosticare mancati click CDP e rifiuti dei comandi VS Code

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

