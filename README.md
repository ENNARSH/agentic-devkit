# Agentic DevKit | Local AI IDE

Benvenuto nell'Agentic DevKit. Questa applicazione è configurata per funzionare interamente in locale usando la potenza dei tuoi componenti hardware.

## Requisiti e Setup Locale

Per far funzionare l'applicazione correttamente sul tuo PC, segui questi passaggi:

1.  **Installa Ollama**:
    - Scarica e installa Ollama da [ollama.com](https://ollama.com).
    - Assicurati che Ollama sia in esecuzione (dovresti vedere l'icona nella barra di sistema).

2.  **Verifica Modello AI**:
    - Hai già il modello necessario: `llama3.1:latest`. 
    - Se vuoi usare un modello diverso (es. `qwen2.5-coder:7b`), modifica il file `src/ai/genkit.ts`.

3.  **Configurazione Progetto**:
    - Scarica il codice di questo progetto.
    - Esegui `npm install` nella cartella principale per installare tutte le dipendenze.
    - Esegui `npm run dev` per avviare l'applicazione su `http://localhost:9002`.

## Funzionalità Principali

- **Local LLM**: Utilizza `llama3.1:latest` tramite Ollama per analisi del codice e pianificazione dei task senza inviare dati al cloud.
- **Indexing Semantico**: Scansiona il tuo progetto locale per creare una mappa mentale che l'AI userà come contesto.
- **Agentic Planning**: L'agente genera piani d'azione strutturati per risolvere problemi complessi di sviluppo.
- **UI Professionale**: Interfaccia basata su pannelli ridimensionabili ispirata ai moderni IDE.

## Risoluzione Problemi

- **Errore di Connessione**: Se l'AI non risponde, verifica che Ollama sia attivo su `http://localhost:11434`.
- **Performance**: Hai già modelli di ottima taglia. `llama3.1:latest` è perfetto per questo scopo.
- **Indexing**: Ricordati di inserire il path assoluto della tua cartella di lavoro nella sidebar prima di cliccare su "Index Project".
