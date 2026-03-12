'use server';
/**
 * @fileOverview A flow for explaining, identifying issues, and suggesting improvements for a given code snippet.
 *
 * - explainAndRefineCode - A function that handles the code explanation and refinement process.
 * - CodeExplanationAndRefinementInput - The input type for the explainAndRefineCode function.
 * - CodeExplanationAndRefinementOutput - The return type for the explainAndRefineCode function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CodeExplanationAndRefinementInputSchema = z.object({
  codeSnippet: z.string().describe('The code snippet to be analyzed.'),
  context: z.string().optional().describe('Additional context about the code snippet (e.g., its purpose, surrounding files).'),
  requestType: z.enum([
    'explain',
    'identify_issues',
    'suggest_improvements',
    'all',
  ]).describe('The type of analysis requested: explanation, issue identification, improvement suggestions, or all.'),
});
export type CodeExplanationAndRefinementInput = z.infer<typeof CodeExplanationAndRefinementInputSchema>;

const CodeExplanationAndRefinementOutputSchema = z.object({
  explanation: z.string().optional().describe('A detailed explanation of the code snippet\'s functionality.'),
  issues: z.array(z.string()).optional().describe('A list of potential issues or bugs identified in the code.'),
  suggestions: z.array(z.string()).optional().describe('A list of suggestions for improving the code (e.g., performance, readability, best practices).'),
});
export type CodeExplanationAndRefinementOutput = z.infer<typeof CodeExplanationAndRefinementOutputSchema>;

export async function explainAndRefineCode(input: CodeExplanationAndRefinementInput): Promise<CodeExplanationAndRefinementOutput> {
  return codeExplanationAndRefinementFlow(input);
}

const prompt = ai.definePrompt({
  name: 'codeExplanationAndRefinementPrompt',
  input: { schema: CodeExplanationAndRefinementInputSchema },
  output: { schema: CodeExplanationAndRefinementOutputSchema },
  prompt: `You are an expert software engineer tasked with analyzing a given code snippet.

Your goal is to provide a comprehensive response based on the user's specific request type.

Request Type: {{{requestType}}}

Code Snippet:
"""
{{{codeSnippet}}}
"""

{{#if context}}
Additional Context:
"""
{{{context}}}
"""
{{/if}}

--- Start of Response ---

{{#if (eq requestType 'explain')}}
Provide only a detailed explanation of the code's functionality. Do not include issues or suggestions.
{{/if}}

{{#if (eq requestType 'identify_issues')}}
Analyze the code for potential issues, bugs, or anti-patterns. Provide only a list of identified issues. Do not include an explanation or suggestions.
{{/if}}

{{#if (eq requestType 'suggest_improvements')}}
Suggest improvements for the code regarding performance, readability, best practices, or maintainability. Provide only a list of suggestions. Do not include an explanation or issues.
{{/if}}

{{#if (eq requestType 'all')}}
First, provide a detailed explanation of the code's functionality.
Second, identify any potential issues, bugs, or anti-patterns.
Third, suggest improvements for the code regarding performance, readability, best practices, or maintainability.

Structure your response as a JSON object with the following fields:
  - 'explanation': (string) A detailed explanation of the code snippet's functionality.
  - 'issues': (array of strings) A list of potential issues or bugs identified in the code.
  - 'suggestions': (array of strings) A list of suggestions for improving the code.
{{/if}}

Output ONLY a valid JSON object matching the requested fields, even if some fields are empty arrays or undefined based on the request type.
`,
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
      throw new Error('LLM did not return an output.');
    }

    // Depending on the requestType, we might only get certain fields. Ensure others are undefined/empty arrays.
    const result: CodeExplanationAndRefinementOutput = {};

    if (input.requestType === 'explain' || input.requestType === 'all') {
      result.explanation = output.explanation;
    }
    if (input.requestType === 'identify_issues' || input.requestType === 'all') {
      result.issues = output.issues || [];
    }
    if (input.requestType === 'suggest_improvements' || input.requestType === 'all') {
      result.suggestions = output.suggestions || [];
    }
    
    // If the LLM returns issues/suggestions for 'explain' only, filter them out.
    if (input.requestType === 'explain') {
      delete result.issues;
      delete result.suggestions;
    }
    if (input.requestType === 'identify_issues') {
      delete result.explanation;
      delete result.suggestions;
    }
    if (input.requestType === 'suggest_improvements') {
      delete result.explanation;
      delete result.issues;
    }

    return result;
  }
);
