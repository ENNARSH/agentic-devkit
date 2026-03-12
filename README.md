
# Agentic DevKit | Local AI IDE

Benvenuto nell'Agentic DevKit. Questa applicazione è configurata per funzionare interamente in locale usando la potenza dei tuoi componenti hardware.

## Requisiti e Setup Locale

Per far funzionare l'applicazione correttamente sul tuo PC, segui questi passaggi:

1.  **Installa Ollama**:
    - Scarica e installa Ollama da [ollama.com](https://ollama.com).
    - Assicurati che Ollama sia in esecuzione (dovresti vedere l'icona nella barra di sistema).

2.  **Scarica i Modelli Consigliati**:
    - Per PC con molta RAM (16GB+): `ollama pull qwen2.5-coder:7b`
    - Per PC con poca RAM: `ollama pull llama3.2:3b`
    - Puoi cambiare il modello nel file `src/ai/genkit.ts`.

3.  **Configurazione Progetto**:
    - Esegui `npm install` nella cartella principale.
    - Esegui `npm run dev` per avviare l'applicazione su `http://localhost:9002`.

## Funzionalità Principali

- **Local LLM**: Utilizza modelli open-source tramite Ollama per analisi del codice privata al 100%.
- **Indexing Semantico**: Scansiona il tuo progetto locale per creare una mappa mentale che l'AI userà come contesto.
- **Agentic Planning**: L'agente genera piani d'azione strutturati per risolvere problemi complessi.
- **UI Professionale**: Interfaccia basata su pannelli ridimensionabili ispirata ai moderni IDE.

## Risoluzione Problemi

- **Errore di Memoria**: Se ricevi un errore "memory", significa che il modello è troppo grande. Usa `llama3.2:3b`.
- **Errore di Connessione**: Se l'AI non risponde, verifica che Ollama sia attivo su `http://localhost:11434`.
- **Indexing**: Ricordati di inserire il path assoluto della tua cartella di lavoro nella sidebar.
