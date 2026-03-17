import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

/**
 * Configurazione centrale Genkit.
 * Modelli consigliati per Ollama (da scaricare con 'ollama pull <nome>'):
 * - 'ollama/qwen2.5-coder:7b' -> BILANCIATO: Il migliore per programmare su PC con 16GB+ RAM.
 * - 'ollama/llama3.2:3b'     -> LEGGERO: Molto veloce, ideale se il PC rallenta.
 * - 'ollama/llama3.1:8b'     -> POTENTE: Ottimo ragionamento, ma richiede più RAM.
 */
export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
    }),
  ],
  // Cambia questa riga per testare modelli diversi senza toccare i flow
  model: 'ollama/qwen2.5-coder:7b',
});
