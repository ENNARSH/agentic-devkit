
import { genkit } from 'genkit';
import { ollama } from 'genkitx-ollama';

export const ai = genkit({
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
    }),
  ],
  model: 'ollama/llama3.1:latest',
});
