import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

/**
 * Configurazione centrale Genkit.
 * Abbiamo aggiunto mappature esplicite per i modelli locali per abilitare i Tools.
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
      ]
    }),
  ],
});
