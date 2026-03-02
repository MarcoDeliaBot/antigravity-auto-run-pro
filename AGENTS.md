# Regole di fine task per l'agente

Ogni volta che finisci un lavoro / task completo, **DEVI obbligatoriamente** eseguire questi passaggi in ordine:

1. **Upload su GitHub**: Aggiungi le modifiche a git (`git add .`), crea un commit descrittivo per la versione attuale (`git commit -m "Bump version to vX.X.X"`) e assicurati di caricare tutto sul repository remoto (`git push`).
2. **Preparare il pacchetto Installabile (.vsix)**: Compila l'estensione nel formato pronto all'installazione per VS Code eseguendo il comando `npx vsce package`. Verrà creato un file `.vsix`. Crea *anche* il .zip come backup del codice sorgente se richiesto.
3. **Salvataggio nella cartella _backup**: Sposta o copia il file `.vsix` appena generato (ed eventualmente lo zip del sorgente) nella sottocartella `_backup/` all'interno della root del progetto.

Assicurati che al termine del processo tutti i file siano salvati correttamente e che l'utente sia stato informato della corretta esecuzione di questi tre step.
