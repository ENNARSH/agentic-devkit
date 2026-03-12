
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a step-by-step plan
 * for a development task using available AI tools and local Ollama.
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

// Tool Definitions
const fileReadingTool = ai.defineTool(
  {
    name: 'fileReadingTool',
    description: 'Reads the content of a specific file within the project.',
    inputSchema: z.object({
      filePath: z
        .string()
        .describe('The path to the file to read, relative to the project root.'),
    }),
    outputSchema: z.object({
      content: z.string(),
    }),
  },
  async (input) => ({ content: `Simulated content for ${input.filePath}` })
);

const agenticTaskPlanningPrompt = ai.definePrompt({
  name: 'agenticTaskPlanningPrompt',
  input: { schema: AgenticTaskPlanningInputSchema },
  output: { schema: AgenticTaskPlanningOutputSchema },
  tools: [fileReadingTool],
  prompt: `You are an expert AI agent specialized in software planning.
Analyze the task: {{{developmentTask}}}

Create a plan using JSON format. For each step, include 'step', 'tool' (optional), and 'toolInput' (optional).
Avoid using code blocks inside the descriptions to prevent parsing issues.

Available Tools:
1. fileReadingTool: Reads a file. Input: {"filePath": "string"}`,
});

const agenticTaskPlanningFlow = ai.defineFlow(
  {
    name: 'agenticTaskPlanningFlow',
    inputSchema: AgenticTaskPlanningInputSchema,
    outputSchema: AgenticTaskPlanningOutputSchema,
  },
  async (input) => {
    const { output } = await agenticTaskPlanningPrompt(input);
    if (!output) throw new Error('No output from Ollama');
    return output;
  }
);

export async function agenticTaskPlanning(
  input: AgenticTaskPlanningInput
): Promise<AgenticTaskPlanningOutput> {
  return agenticTaskPlanningFlow(input);
}
