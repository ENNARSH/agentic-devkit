import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

/**
 * Configurazione centrale Genkit.
 * Abbiamo aggiunto mappature esplicite per i modelli locali per abilitare i Tools.
 * Includiamo i nomi esatti riportati da 'ollama list' e le varianti con prefisso registry.
 */
export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
      models: [
        // Modelli Gemma 3
        { name: 'gemma3:latest', info: { supports: { tools: true } } },
        { name: 'gemma3:4b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/gemma3:latest', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/gemma3:4b', info: { supports: { tools: true } } },
        
        // Modelli Qwen 2.5 Coder
        { name: 'qwen2.5-coder:7b', info: { supports: { tools: true } } },
        { name: 'qwen2.5-coder:14b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/qwen2.5-coder:7b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/qwen2.5-coder:14b', info: { supports: { tools: true } } },
        
        // Altri modelli nella lista dell'utente
        { name: 'deepseek-r1:8b', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/deepseek-r1:8b', info: { supports: { tools: true } } },
        { name: 'mistral:latest', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/mistral:latest', info: { supports: { tools: true } } },
        { name: 'llama3.1:latest', info: { supports: { tools: true } } },
        { name: 'registry.ollama.ai/library/llama3.1:latest', info: { supports: { tools: true } } },
        
        // Modelli GPT OSS
        { name: 'gpt-oss:20b', info: { supports: { tools: true } } },
      ]
    }),
  ],
});
