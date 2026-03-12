
'use server';
/**
 * @fileOverview A Genkit flow for performing semantic code search within a project via Ollama.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticCodeSearchInputSchema = z.object({
  query: z.string().describe('The natural language query for semantic code search.'),
});
export type SemanticCodeSearchInput = z.infer<typeof SemanticCodeSearchInputSchema>;

const SemanticCodeSearchOutputSchema = z.object({
  results: z.array(z.object({
    filePath: z.string(),
    codeSnippet: z.string(),
    explanation: z.string().optional(),
  })),
});
export type SemanticCodeSearchOutput = z.infer<typeof SemanticCodeSearchOutputSchema>;

const codeSearchTool = ai.defineTool(
  {
    name: 'codeSearch',
    description: 'Performs search.',
    inputSchema: z.object({
      query: z.string(),
    }),
    outputSchema: z.array(z.object({
      filePath: z.string(),
      codeSnippet: z.string(),
    })),
  },
  async (input) => {
    return [
      {
        filePath: 'src/utils/helpers.ts',
        codeSnippet: '// Dummy result for local search',
      },
    ];
  }
);

const semanticCodeSearchPrompt = ai.definePrompt({
  name: 'semanticCodeSearchPrompt',
  input: {schema: SemanticCodeSearchInputSchema},
  output: {schema: SemanticCodeSearchOutputSchema},
  tools: [codeSearchTool],
  prompt: `Search the codebase for: "{{{query}}}" and present the findings. Return JSON with 'results' array.`,
});

const semanticCodeSearchFlow = ai.defineFlow(
  {
    name: 'semanticCodeSearchFlow',
    inputSchema: SemanticCodeSearchInputSchema,
    outputSchema: SemanticCodeSearchOutputSchema,
  },
  async (input) => {
    const {output} = await semanticCodeSearchPrompt(input);
    return output!;
  }
);

export async function semanticCodeSearch(input: SemanticCodeSearchInput): Promise<SemanticCodeSearchOutput> {
  return semanticCodeSearchFlow(input);
}
