'use server';
/**
 * @fileOverview A Genkit flow for performing semantic code search within the local project index.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {loadProjectIndex} from './ai-codebase-indexing';

const SemanticCodeSearchInputSchema = z.object({
  query: z.string().describe('The natural language query for semantic code search.'),
});
export type SemanticCodeSearchInput = z.infer<typeof SemanticCodeSearchInputSchema>;

const SemanticCodeSearchOutputSchema = z.object({
  results: z.array(z.object({
    filePath: z.string(),
    semanticSummary: z.string(),
    score: z.number().optional(),
  })),
});
export type SemanticCodeSearchOutput = z.infer<typeof SemanticCodeSearchOutputSchema>;

const semanticCodeSearchPrompt = ai.definePrompt({
  name: 'semanticCodeSearchPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      indexData: z.string(),
    })
  },
  output: {schema: SemanticCodeSearchOutputSchema},
  prompt: `You are an expert developer assistant. 
Based on the provided Project Index, find the most relevant files for the following query: "{{{query}}}"

Project Index:
{{{indexData}}}

Return a JSON object with a 'results' array containing the top relevant files. Each result should include 'filePath' and 'semanticSummary'.`,
});

const semanticCodeSearchFlow = ai.defineFlow(
  {
    name: 'semanticCodeSearchFlow',
    inputSchema: SemanticCodeSearchInputSchema,
    outputSchema: SemanticCodeSearchOutputSchema,
  },
  async (input) => {
    const index = await loadProjectIndex();
    if (index.length === 0) {
      return { results: [] };
    }

    // Pass the first 100 entries to avoid context window issues
    const contextLimit = 100;
    const indexData = index.slice(0, contextLimit).map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n');

    const {output} = await semanticCodeSearchPrompt({
      query: input.query,
      indexData
    });

    return output || { results: [] };
  }
);

export async function semanticCodeSearch(input: SemanticCodeSearchInput): Promise<SemanticCodeSearchOutput> {
  return semanticCodeSearchFlow(input);
}
