## [1.7.9] - 2026-03-26

### Fixed
- **Critical: Smart Expand Targeting** — Root cause del "si blocca su Expand". Quando l'UI mostra sia "Progress Updates — Expand all" che "1 Step Requires Input — Expand", il TreeWalker trovava il primo `Expand all` nel DOM (per le Progress Updates) e cliccava quello invece dell'`Expand` specifico per lo step che richiede input. Aggiunta fase prioritaria `findRequiresInputExpand()` che localizza l'elemento "requires input" e clicca SOLO l'Expand dentro quella sezione.
- **Critical: isGenerating() False Positive** — Il pulsante Stop ■ nella barra input dell'IDE Antigravity è sempre presente nel DOM (anche durante lo stato "Waiting.."). `isGenerating()` lo rilevava e ritornava `true`, bloccando TUTTO il rilevamento pulsanti. Aggiunto check di visibilità (`offsetParent`, `display`, `visibility`, `opacity`, `disabled`, `getBoundingClientRect`) — solo pulsanti stop visibili e attivi triggerano il guard.
- **Robust Click Dispatch** — Sostituito il semplice `btn.click()` con sequenza completa `pointerdown → mousedown → pointerup → mouseup → click` con coordinate reali (`getBoundingClientRect`). I componenti React/Preact nell'IDE Antigravity possono intercettare `mousedown`/`pointerdown` invece di `click`, causando click silenziosamente ignorati.

## [1.7.8] - 2026-03-25

### Fixed
- **Critical: Chrome Port Conflict** — Root cause del problema intermittente "smette di funzionare". Chrome (o altri browser) poteva occupare la porta 9222, impedendo all'IDE Antigravity di bindare la propria porta di debug. L'estensione trovava i target Chrome invece dei webview dell'agente, risultando in "CDP Status: Disconnected" e zero click.
- **Dedicated Port 9333**: L'estensione ora usa la porta 9333 come porta primaria, dedicata esclusivamente ad Antigravity. La porta 9222 resta come fallback ma con conflict detection.
- **Port Conflict Detection**: `checkAndFixCDP()` ora verifica se la porta 9222 è occupata da Chrome (analizzando gli URL dei target: `vscode-webview://` = Antigravity, `http://` = Chrome) e mostra un warning specifico con opzione auto-fix.
- **Shortcut Migration**: Il patcher Windows ora migra automaticamente i shortcut dalla vecchia porta 9222 alla nuova 9333, senza creare duplicati del flag.

## [1.7.7] - 2026-03-25

### Fixed
- **Critical: Immortal Polling Loops** (`runVsCodePolling`, `runCdpPolling`): Entrambi i loop di polling ricorsivi ora sono wrappati in try/catch esterno. Precedentemente, qualsiasi eccezione non gestita (es. errore nella lettura della config, crash inatteso in `checkPermissionButtons`) uccideva silenziosamente la catena `setTimeout` — il polling si fermava per sempre ma la status bar mostrava ancora "Auto: ON". **Questa era la causa principale del "smette di funzionare senza motivo".**
- **CDP Startup Retry** (`cdpStartupCheck`): L'estensione ora ritenta la connessione CDP fino a 5 volte con backoff crescente (3s, 6s, 9s, 12s, 15s) all'avvio. Precedentemente, se la porta debug non era pronta al momento dell'attivazione (IDE in caricamento, reload lento), l'estensione restava morta fino a toggle manuale.
- **WebSocket CONNECTING→CLOSED Race** (`cdpEvaluate`): Aggiunta gestione esplicita per WebSocket che falliscono durante la fase CONNECTING senza mai raggiungere OPEN. L'handler `once('error')`/`once('close')` sulla Promise path risolve immediatamente con `null` e pulisce il pool, invece di aspettare il timeout di 1500ms.

### Removed
- **Dead Code Cleanup**: Rimosse le funzioni `cdpSendMulti()` e `clickBannerViaDom()` (~120 righe) che non erano chiamate da nessuna parte nel codice attivo. Queste funzioni creavano WebSocket non pooled che potevano confliggere con il pool principale (CDP permette una sola connessione per target).

## [1.7.6] - 2026-03-23

### Fixed
- **Critical: CDP Mutex Deadlock Fix** (`isCheckingCDP`): Spostato il rilascio della guardia mutex nel blocco `finally{}`. Precedentemente, se `cdpEvaluate()` andava in timeout o un `return` anticipato veniva eseguito, `isCheckingCDP` restava `true` per sempre — bloccando silenziosamente tutto il polling CDP fino al riavvio dell'estensione. **Questa era la causa principale del problema intermittente "smette di funzionare".**
- **WebSocket Listener Leak**: Aggiunto `removeListener('message')` nel timeout di `cdpEvaluate()`. Precedentemente, listener non rimossi si accumulavano ad ogni chiamata fallita, causando rallentamento progressivo e risposte confuse.
- **CDP Response Collision**: Sostituito l'ID hardcoded `1` con un contatore incrementale (`nextCdpId++`) per le chiamate `Runtime.evaluate`. Con il pool WebSocket, due chiamate sulla stessa connessione potevano confondere le risposte.
- **WebSocket Orphan Leak**: Aggiunto `ws.close()` nei handler `error` di `clickBannerViaDom()` e `cdpSendMulti()` per chiudere le connessioni orfane in caso di errore.
- **Deactivation Cleanup**: La funzione `deactivate()` ora chiude tutte le connessioni WebSocket nel pool e svuota la Map, prevenendo leak post-reload.
- **Log Rotation**: Implementata rotazione automatica del file di log quando supera 1 MB, prevenendo crescita infinita del file su disco.

## [1.7.5] - 2026-03-14

### Fixed
- **Permission Prompt Loop Fix**: Risolto problema dove i prompt di permesso (come "Allow Once" per l'accesso alle cartelle) smettevano di essere cliccati dopo il primo tentativo fallito. Questi pulsanti sono ora esenti dal tagging anti-duplicato e vengono ri-cliccati finché il prompt non scompare.

## [1.7.4] - 2026-03-14

### Fixed
- **Expand Button Stuck on "Waiting.."**: Risolto bug critico dove il pulsante "Expand" nella barra "1 Step Requires Input" non veniva cliccato perché il meccanismo di tagging anti-duplicato (`data-ag-clicked`) lo bloccava quando il fingerprint dell'output dell'AI non cambiava. I pulsanti expand, collapse, requires input e changes overview sono ora esenti dal tagging e possono essere ri-cliccati liberamente.
- **Anchor Tag Detection**: Migliorato `closestClickable` per riconoscere anche elementi `<a>` come target cliccabili, coprendo strutture DOM alternative della UI Gemini.

## [1.7.3] - 2026-03-14

### Fixed
- **CDP Stability**: Corretti bug critici `cdpAttempted` e `watchdogTimer` (ReferenceError) che causavano crash silenziosi del loop di polling.
- **Enhanced Expansion**: Aggiunto supporto completo per i pulsanti "Expand all", "Collapse all" e le varianti italiane nell'interfaccia dell'agente.
- **Robust Text Matching**: Implementata la normalizzazione del testo per gestire icone SVG annidate e spazi multipli nei pulsanti.
- **Anti-Loop Calibration**: Aggiornate le soglie di tolleranza per i nuovi pulsanti di espansione per prevenire attivazioni errate della modalità Standby.

## [1.7.2] - 2026-03-14

### Added
- **Overtaker Mode**: Implementato pool di WebSocket persistenti (Caching) per azzerare la latenza di handshake CDP.
- **Proactive Auto-Click**: Aggiunto supporto per il pulsante "Changes Overview" (Panoramica modifiche), eliminando un noto punto di stallo manuale dell'IDE.

## [1.7.1] - 2026-03-14
- **Zero-Focus-Theft**: Protezione nativa degli eventi di focus per impedire a VS Code di interferire durante l'automazione.
- **Button Tagging**: Implementata la marcatura degli elementi DOM (`data-ag-clicked`) per prevenire click duplicati con precisione chirurgica.
- **Rich Dashboard**: Il tooltip della StatusBar ora mostra statistiche in tempo reale, stato della connessione CDP e cronologia azioni.
- **Audit Mode**: Nuova modalità "Dry-run" per testare l'automazione senza eseguire click reali (Toggle via `autorunpro.toggleAudit`).
- **Button Census**: Nuovo comando diagnostico per elencare tutti i pulsanti cliccabili trovati nel pannello dell'Agente.

## [1.6.9] - 2026-03-14

## [1.6.7] - 2026-03-13

### Fixed
- **Anti-Loop Optimization (Always Run)**: Aumentata la soglia di tolleranza per i pulsanti "Always Run" e "Esegui sempre" a 30 click (come per il pulsante Expand), riducendo i falsi positivi di standby durante le operazioni repetitive.
- **Diagnostics**: Corretta la stringa di versione riportata nei log diagnostici.

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

