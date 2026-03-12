
import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434', // Indirizzo standard di Ollama locale
    }),
  ],
  model: 'ollama/llama3', // Modello predefinito da usare localmente
});
