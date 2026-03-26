# Test Prompt per Antigravity Auto Run Pro v1.7.9

## Istruzioni
Copia e incolla uno dei prompt qui sotto nell'agente Antigravity.
L'estensione deve cliccare automaticamente tutti i pulsanti (Run, Accept, Expand).
Monitora il tooltip nella status bar per verificare i click.

---

## Prompt di Test (copia questo)

```
Esegui questi passaggi uno alla volta, aspettando la mia approvazione per ognuno:

1. Esegui: echo "=== TEST STEP 1: Basic Run ===" && echo "Timestamp: $(date)" && echo "OK"

2. Esegui: echo "=== TEST STEP 2: Multi-line ===" && echo "Line A" && echo "Line B" && echo "Line C" && echo "OK"

3. Esegui: echo "=== TEST STEP 3: File ops ===" && echo "test-content-179" > /tmp/ag_test_179.txt && cat /tmp/ag_test_179.txt && rm /tmp/ag_test_179.txt && echo "Cleaned up. OK"

4. Esegui: echo "=== TEST STEP 4: Env check ===" && node -e "console.log('Node:', process.version); console.log('Platform:', process.platform); console.log('OK')"

5. Esegui: echo "=== TEST STEP 5: Slow command ===" && echo "Starting..." && ping -n 3 127.0.0.1 > nul && echo "Done. OK"

6. Crea un file chiamato /tmp/ag_test_final.txt con dentro "Antigravity Auto Run Pro v1.7.9 - Test completato con successo!" e poi mostrami il contenuto.

7. Esegui: echo "=== TEST COMPLETE ===" && echo "All 7 steps executed successfully"
```

---

## Cosa verificare

### Pulsanti che devono essere cliccati automaticamente:
- [ ] **"Run"** / **"Run Alt+D"** — comando terminale (ogni step)
- [ ] **"Expand"** — quando appare "X Steps Requires Input → Expand"
- [ ] **"Accept"** — accettazione modifiche file (step 6)
- [ ] **"Allow"** — se appare richiesta permessi cartella (solo in God Mode)

### Metriche da controllare nel tooltip (hover sulla status bar):
- [ ] CDP Status: **Connected (Port 9333)** o **(Port 9222)**
- [ ] Total Clicks: dovrebbe salire ad ogni azione
- [ ] Last Action: mostra l'ultimo pulsante cliccato
- [ ] Backoff Level: dovrebbe restare basso (0-3)

### Scenari critici (quelli che fallivano prima):
- [ ] **"1 Step Requires Input → Expand <"** viene cliccato (non resta in "Waiting..")
- [ ] L'estensione NON clicca "Expand all" delle Progress Updates al posto dell'Expand dello step
- [ ] Nessun blocco durante lo stato "Waiting.." (fix isGenerating false positive)

---

## Se il test fallisce

1. Apri il log: `Ctrl+Shift+P` → "AntiGravity: Open Log File"
2. Cerca queste righe:
   - `'generating'` — indica false positive di isGenerating()
   - `'not-agent-panel'` — il webview guard non riconosce il pannello
   - `'no-permission-button'` — nessun pulsante trovato nel DOM
   - `'clicked:requires-input-expand'` — ✅ il nuovo fix ha funzionato!
   - `'clicked:expand'` — il vecchio path generico (potrebbe aver preso quello sbagliato)
3. Controlla CDP Status nel tooltip — se "Disconnected", il debug port non è attivo
