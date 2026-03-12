# **App Name**: Agentic DevKit

## Core Features:

- Project Indexing: Scansiona e indicizza ricorsivamente tutti i file in una directory di progetto specificata (ad esempio, C:\Workspaces\tecno-asset), creando un indice contestuale ottimizzato per le operazioni degli agenti AI.
- LLM Service Integration: Integra un servizio LLM locale (ad esempio, tramite Ollama) per abilitare il ragionamento, la comprensione del codice e la generazione di risposte e comandi agentici.
- File Reading Tool: Un tool basato sull'AI per leggere il contenuto di file specifici all'interno dei progetti indicizzati, fornendo all'LLM contesto on-demand.
- Code Search Tool: Un tool basato sull'AI per eseguire ricerche contestuali e semantiche nel codice all'interno dei progetti indicizzati.
- Agentic Command Planner: Utilizza il ragionamento dell'LLM come tool planner per analizzare i requisiti dell'utente, selezionare gli strumenti appropriati e generare un piano d'azione per completare attività complesse.
- Code Navigation & Analysis Tool: Un tool basato sull'AI per la navigazione avanzata del codice (es. vai alla definizione) e per eseguire analisi semantiche che aiutano l'LLM nella comprensione della struttura del codice.
- User Interface for Agent Interaction: Fornisce un'interfaccia intuitiva per visualizzare lo stato dell'indicizzazione, interagire con gli agenti AI e ricevere output, suggerimenti e comandi eseguiti.

## Style Guidelines:

- Color scheme: Dark. Emphasizing focus and reducing eye strain for development tasks. Primary actions and highlights use a deep, vibrant violet (#9352FF), suggesting innovation and intelligence against a very dark, desaturated background (#26202B). An analogous, soft blue (#A7CCFF) serves as an accent for subtle visual cues and secondary elements.
- Headlines and prominent text will use 'Space Grotesk' (sans-serif) for a modern, technical aesthetic. Body text and longer content will use 'Inter' (sans-serif) for high readability and clarity. Code blocks and snippets will be rendered with 'Source Code Pro' (monospace sans-serif) for optimal legibility in programming contexts.
- Use minimalist, functional, and clean line icons. Focus on symbols that clearly represent development concepts, AI processes, file operations, search functionalities, and navigation. Icons should integrate seamlessly with the dark theme and not distract from the content.
- Adopt a multi-panel, highly configurable layout, reminiscent of modern IDEs. This allows users to view indexed projects, agent interactions, code editor, and output logs simultaneously. Panels should be resizable and collapsible to optimize screen real estate based on workflow.
- Implement subtle, non-intrusive animations for state changes, loading indicators, and tool execution feedback. Use smooth transitions for panel resizing and content updates to enhance the user experience without causing distraction during intense coding or agent interaction.