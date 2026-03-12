# Agentic DevKit | Local AI IDE

Benvenuto nell'Agentic DevKit. Questa applicazione è configurata per funzionare interamente in locale usando la potenza dei tuoi componenti hardware.

## Requisiti e Setup Locale

Per far funzionare l'applicazione correttamente sul tuo PC, segui questi passaggi:

1.  **Installa Ollama**:
    - Scarica e installa Ollama da [ollama.com](https://ollama.com).
    - Assicurati che Ollama sia in esecuzione (dovresti vedere l'icona nella barra di sistema).

2.  **Scarica il Modello AI**:
    - Apri il tuo terminale (Prompt dei comandi, PowerShell o Terminale Mac/Linux).
    - Esegui il comando: `ollama run llama3`
    - Questo scaricherà circa 4GB di dati. Una volta terminato, puoi chiudere il terminale o lasciarlo aperto per testare il modello.

3.  **Configurazione Progetto**:
    - Scarica il codice di questo progetto.
    - Esegui `npm install` nella cartella principale per installare tutte le dipendenze (Next.js, Genkit, ShadCN, ecc.).
    - Esegui `npm run dev` per avviare l'applicazione su `http://localhost:9002`.

## Funzionalità Principali

- **Local LLM**: Utilizza `llama3` tramite Ollama per analisi del codice e pianificazione dei task senza inviare dati al cloud.
- **Indexing Semantico**: Scansiona il tuo progetto locale per creare una mappa mentale che l'AI userà come contesto.
- **Agentic Planning**: L'agente genera piani d'azione strutturati per risolvere problemi complessi di sviluppo.
- **UI Professionale**: Interfaccia basata su pannelli ridimensionabili ispirata ai moderni IDE.

## Risoluzione Problemi

- **Errore di Connessione**: Se l'AI non risponde, verifica che Ollama sia attivo su `http://localhost:11434`.
- **Performance**: Se le risposte sono lente, assicurati che il tuo computer abbia almeno 8GB di RAM (16GB consigliati per llama3).
- **Indexing**: Ricordati di inserire il path assoluto della tua cartella di lavoro nella sidebar prima di cliccare su "Index Project".
