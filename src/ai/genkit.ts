import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

/**
 * Configurazione centrale Genkit con supporto esplicito ai Tools per modelli locali.
 */
export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
      // Dichiariamo esplicitamente che questi modelli supportano i tools per evitare avvisi di Genkit
      models: [
        { name: 'qwen2.5-coder:7b', info: { supports: { tools: true } } },
        { name: 'qwen2.5-coder:14b', info: { supports: { tools: true } } },
        { name: 'deepseek-r1:8b', info: { supports: { tools: true } } },
        { name: 'llama3.1:latest', info: { supports: { tools: true } } },
        { name: 'mistral:latest', info: { supports: { tools: true } } },
      ]
    }),
  ],
  model: 'ollama/qwen2.5-coder:7b',
});
