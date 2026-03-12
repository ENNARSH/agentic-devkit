
import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
    }),
  ],
  // Passiamo a un modello più leggero (7B o 3B) per evitare crash di memoria
  // Assicurati di averlo scaricato con: ollama pull qwen2.5-coder:7b
  model: 'ollama/qwen2.5-coder:7b',
});
