import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

/**
 * Configurazione centrale Genkit.
 * Qui puoi cambiare il modello "sotto" l'applicazione senza modificare i flow.
 * Modelli consigliati per Ollama:
 * - 'ollama/qwen2.5-coder:7b' (Ottimo per il codice)
 * - 'ollama/llama3.2:3b' (Leggerissimo, per PC con poca RAM)
 */
export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
    }),
  ],
  model: 'ollama/qwen2.5-coder:7b',
});
