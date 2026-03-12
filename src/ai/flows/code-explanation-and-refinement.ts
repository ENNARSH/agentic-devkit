
'use server';
/**
 * @fileOverview A flow for code explanation using local Ollama.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CodeExplanationAndRefinementInputSchema = z.object({
  codeSnippet: z.string().describe('The code snippet to be analyzed.'),
  context: z.string().optional().describe('Additional context about the code snippet.'),
  requestType: z.enum([
    'explain',
    'identify_issues',
    'suggest_improvements',
    'all',
  ]),
});
export type CodeExplanationAndRefinementInput = z.infer<typeof CodeExplanationAndRefinementInputSchema>;

const CodeExplanationAndRefinementOutputSchema = z.object({
  explanation: z.string().optional(),
  issues: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});
export type CodeExplanationAndRefinementOutput = z.infer<typeof CodeExplanationAndRefinementOutputSchema>;

const prompt = ai.definePrompt({
  name: 'codeExplanationAndRefinementPrompt',
  input: { schema: CodeExplanationAndRefinementInputSchema },
  output: { schema: CodeExplanationAndRefinementOutputSchema },
  prompt: `You are an expert software engineer analyzing code.

Request Type: {{{requestType}}}

Code Snippet:
{{{codeSnippet}}}

{{#if context}}
Context: {{{context}}}
{{/if}}

Provide your analysis in JSON format with fields: explanation, issues (array), suggestions (array).`,
});

const codeExplanationAndRefinementFlow = ai.defineFlow(
  {
    name: 'codeExplanationAndRefinementFlow',
    inputSchema: CodeExplanationAndRefinementInputSchema,
    outputSchema: CodeExplanationAndRefinementOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Ollama did not return an output.');
    }
    return output;
  }
);

export async function explainAndRefineCode(input: CodeExplanationAndRefinementInput): Promise<CodeExplanationAndRefinementOutput> {
  return codeExplanationAndRefinementFlow(input);
}
