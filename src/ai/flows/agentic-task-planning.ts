
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a step-by-step plan.
 * Integrated with the project index for context-aware planning.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { loadProjectIndex } from './ai-codebase-indexing';

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
  input: { 
    schema: z.object({
      developmentTask: z.string(),
      projectContext: z.string(),
    }) 
  },
  output: { schema: AgenticTaskPlanningOutputSchema },
  prompt: `You are an expert software architect.
  
Project Context (Summarized File structure):
{{{projectContext}}}

User Task: {{{developmentTask}}}

Generate a structured action plan in JSON format. Each step should refer to existing files from the context if applicable.
Each step should have:
1. 'step': A description of the action.
2. 'tool': (Optional) The tool name.
3. 'toolInput': (Optional) JSON input for the tool.

Format the response as JSON with a 'plan' array.`,
});

const agenticTaskPlanningFlow = ai.defineFlow(
  {
    name: 'agenticTaskPlanningFlow',
    inputSchema: AgenticTaskPlanningInputSchema,
    outputSchema: AgenticTaskPlanningOutputSchema,
  },
  async (input) => {
    // Load existing index to provide context to the LLM
    const projectIndex = await loadProjectIndex();
    const projectContext = projectIndex.length > 0 
      ? projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n')
      : "No index available. The project hasn't been scanned yet.";

    console.log(`Planning task: ${input.developmentTask}`);
    const { output } = await agenticTaskPlanningPrompt({
      developmentTask: input.developmentTask,
      projectContext: projectContext.substring(0, 10000), // Limit context size
    });

    if (!output) throw new Error('No output from AI');
    return output;
  }
);

export async function agenticTaskPlanning(
  input: AgenticTaskPlanningInput
): Promise<AgenticTaskPlanningOutput> {
  return agenticTaskPlanningFlow(input);
}
