# Regole di fine task per l'agente

Ogni volta che finisci un lavoro / task completo, **DEVI obbligatoriamente** eseguire questi passaggi in ordine:

1. **Upload su GitHub**: Aggiungi le modifiche a git (`git add .`), crea un commit descrittivo per la versione attuale (`git commit -m "Bump version to vX.X.X"`) e assicurati di caricare tutto sul repository remoto (`git push`).
2. **Preparare il pacchetto e Backup**: Crea un file `.zip` dell'intero progetto (escludendo `node_modules`, `.git` e la cartella `_backup`).
3. **Salvataggio nella cartella _backup**: Rinomina il file zip come `[nome_progetto]_v[versione].zip` e posizionalo nella sottocartella `_backup/` all'interno della root del progetto.

Assicurati che al termine del processo tutti i file siano salvati correttamente e che l'utente sia stato informato della corretta esecuzione di questi tre step.
