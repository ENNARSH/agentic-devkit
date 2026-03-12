
# Agentic DevKit | Local AI IDE

Benvenuto nell'Agentic DevKit. Questa applicazione è configurata per funzionare interamente in locale.

## Come Funziona

1.  **AI Locale**: L'app utilizza **Ollama** tramite il plugin Genkit. 
    - Assicurati che Ollama sia installato e in esecuzione su `http://localhost:11434`.
    - Assicurati di aver scaricato il modello llama3: `ollama run llama3`.

2.  **Architettura**:
    - **Indexing**: Scansiona il progetto e crea riassunti semantici per dare contesto all'AI.
    - **Planning**: Invece di una semplice chat, l'agente crea piani d'azione strutturati.
    - **UI**: Interfaccia professionale basata su ShadCN e pannelli ridimensionabili.

3.  **Tecnologie**:
    - Next.js 15 (App Router)
    - Genkit 1.x
    - Ollama (Local LLM)
    - Tailwind CSS + Lucide Icons

## Risoluzione Problemi

Se riscontri l'errore "Module not found: react-resizable-panels", è stato risolto con l'ultimo aggiornamento del `package.json`.
Se l'AI non risponde, controlla che Ollama sia attivo nel tuo terminale.
