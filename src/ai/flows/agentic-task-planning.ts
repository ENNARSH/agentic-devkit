
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a step-by-step plan.
 * Fixed parsing issues by avoiding backticks in the prompt template.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z
    .string()
    .describe('A natural language description of the development task.'),
});
export type AgenticTaskPlanningInput = z.infer<
  typeof AgenticTaskPlanningInputSchema
>;

const AgenticTaskPlanningOutputSchema = z.object({
  plan: z
    .array(
      z.object({
        step: z.string().describe('A description of the step.'),
        tool: z
          .string()
          .optional()
          .describe('The name of the tool to be used, if any.'),
        toolInput: z
          .any()
          .optional()
          .describe('The input parameters for the tool in JSON format.'),
      })
    )
    .describe('A step-by-step plan to complete the development task.'),
});
export type AgenticTaskPlanningOutput = z.infer<
  typeof AgenticTaskPlanningOutputSchema
>;

const agenticTaskPlanningPrompt = ai.definePrompt({
  name: 'agenticTaskPlanningPrompt',
  input: { schema: AgenticTaskPlanningInputSchema },
  output: { schema: AgenticTaskPlanningOutputSchema },
  prompt: `You are an expert software architect.
Task: {{{developmentTask}}}

Generate a structured action plan in JSON format. Each step should have:
1. 'step': A description of the action.
2. 'tool': (Optional) The tool name.
3. 'toolInput': (Optional) JSON input for the tool.

Available Tools:
- fileReadingTool: Reads a file. Input: {"filePath": "string"}

Format the response as JSON with a 'plan' array.`,
});

const agenticTaskPlanningFlow = ai.defineFlow(
  {
    name: 'agenticTaskPlanningFlow',
    inputSchema: AgenticTaskPlanningInputSchema,
    outputSchema: AgenticTaskPlanningOutputSchema,
  },
  async (input) => {
    console.log(`Planning task: ${input.developmentTask}`);
    const { output } = await agenticTaskPlanningPrompt(input);
    if (!output) throw new Error('No output from AI');
    return output;
  }
);

export async function agenticTaskPlanning(
  input: AgenticTaskPlanningInput
): Promise<AgenticTaskPlanningOutput> {
  return agenticTaskPlanningFlow(input);
}
