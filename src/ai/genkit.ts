import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

/**
 * Configurazione centrale Genkit.
 * Modelli consigliati per Ollama (da scaricare con 'ollama pull <nome>'):
 * - 'ollama/qwen2.5-coder:7b' -> OTTIMO per i Tools e il codice.
 * - 'ollama/qwen2.5-coder:14b' -> Molto potente se hai abbastanza RAM.
 * - 'ollama/deepseek-r1:8b' -> Eccellente per la logica.
 */
export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
    }),
  ],
  // Modello di fallback se non specificato altrove
  model: 'ollama/qwen2.5-coder:7b',
});
