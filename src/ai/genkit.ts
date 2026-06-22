import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';
import { googleAI } from '@genkit-ai/googleai';

/**
 * Configurazione centrale Genkit.
 * Abbiamo aggiunto mappature esplicite per i modelli locali per abilitare i Tools.
 * Includiamo i nomi esatti riportati da 'ollama list' e le varianti con prefisso registry.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
    ollama({
      serverAddress: 'http://localhost:11434',
      models: [
        // Modelli Gemma
        { name: 'gemma4:e4b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/gemma4:e4b', info: { supports: { tools: true } } },
        { name: 'gemma3:latest', info: { supports: { tools: true } } },
        { name: 'gemma3:4b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/gemma3:latest', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/gemma3:4b', info: { supports: { tools: true } } },
        
        // Modelli Qwen
        { name: 'qwen2.5-coder:7b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/qwen2.5-coder:7b', info: { supports: { tools: true } } },
        { name: 'qwen3.5:9b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/qwen3.5:9b', info: { supports: { tools: true } } },
        { name: 'qwen3:8b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/qwen3:8b', info: { supports: { tools: true } } },
        
        // Altri modelli nella lista dell'utente
        { name: 'deepseek-r1:8b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/deepseek-r1:8b', info: { supports: { tools: true } } },
        { name: 'mistral:latest', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/mistral:latest', info: { supports: { tools: true } } },
        { name: 'llama3.1:latest', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/llama3.1:latest', info: { supports: { tools: true } } },
      ]
    }),
  ],
  model: 'ollama/qwen2.5-coder:7b',
});
