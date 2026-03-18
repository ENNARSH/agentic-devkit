import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

/**
 * Configurazione centrale Genkit.
 * Abbiamo aggiunto mappature esplicite per i modelli locali per abilitare i Tools.
 * Includiamo anche i nomi completi dei registri se Ollama li riporta così.
 */
export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
      models: [
        // Usiamo i nomi esatti che appaiono in 'ollama list'
        { name: 'qwen2.5-coder:7b', info: { supports: { tools: true } } },
        { name: 'qwen2.5-coder:14b', info: { supports: { tools: true } } },
        { name: 'llama3.1:latest', info: { supports: { tools: true } } },
        { name: 'deepseek-r1:8b', info: { supports: { tools: true } } },
        { name: 'mistral:latest', info: { supports: { tools: true } } },
        { name: 'gpt-oss:20b', info: { supports: { tools: true } } },
        // Aggiungiamo varianti per Gemma 3 per coprire diversi tag e nomi registro
        { name: 'gemma3:latest', info: { supports: { tools: true } } },
        { name: 'gemma3:4b', info: { supports: { tools: true } } },
        { name: 'gemma3:12b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/gemma3:latest', info: { supports: { tools: true } } },
      ]
    }),
  ],
});
