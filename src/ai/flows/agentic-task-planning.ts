
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a step-by-step plan
 * for a development task using available AI tools.
 *
 * - agenticTaskPlanning - A wrapper function to execute the planning flow.
 * - AgenticTaskPlanningInput - The input type for the agenticTaskPlanning function.
 * - AgenticTaskPlanningOutput - The return type for the agenticTaskPlanning function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input Schema for the planning flow
const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z
    .string()
    .describe('A natural language description of the development task.'),
});
export type AgenticTaskPlanningInput = z.infer<
  typeof AgenticTaskPlanningInputSchema
>;

// Output Schema for the planning flow, representing the generated plan
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
    outputSchema: z
      .object({
        content: z.string().describe('The content of the file.'),
      })
      .describe('The content of the file.'),
  },
  async (input) => {
    console.log(`Simulating file read for: ${input.filePath}`);
    return { content: `Content of ${input.filePath} (simulated data)` };
  }
);

const codeSearchTool = ai.defineTool(
  {
    name: 'codeSearchTool',
    description:
      'Performs a contextual and semantic search within the project\'s codebase to find relevant code snippets or definitions.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('The natural language query for the code search.'),
      fileFilter: z
        .string()
        .optional()
        .describe(
          'An optional glob pattern to filter files for the search (e.g., "*.ts", "src/**.js").'
        ),
    }),
    outputSchema: z
      .array(
        z.object({
          filePath: z.string().describe('The path to the file.'),
          snippet: z.string().describe('A relevant code snippet.'),
        })
      )
      .describe('An array of relevant code snippets and their file paths.'),
  },
  async (input) => {
    console.log(
      `Simulating code search for query: '${input.query}'`
    );
    return [
      {
        filePath: 'src/components/feature.ts',
        snippet: 'class FeatureComponent { /* ... */ }',
      },
    ];
  }
);

const codeNavigationAnalysisTool = ai.defineTool(
  {
    name: 'codeNavigationAnalysisTool',
    description:
      'Provides advanced code navigation (e.g., go to definition) and semantic analysis for code understanding.',
    inputSchema: z.object({
      type: z
        .enum(['go_to_definition', 'analyze_semantics'])
        .describe('The type of navigation or analysis to perform.'),
      target: z
        .object({
          filePath: z.string().describe('The path to the file.'),
          lineNumber: z.number().describe('The line number.'),
          columnNumber: z.number().describe('The column number.'),
        })
        .optional()
        .describe(
          'The specific location in the code for go_to_definition.'
        ),
      symbol: z
        .string()
        .optional()
        .describe('The symbol to analyze for semantic analysis.'),
    }),
    outputSchema: z
      .object({
        result: z.any().describe('The result of the navigation or analysis operation.'),
      })
      .describe('The result of the navigation or analysis operation.'),
  },
  async (input) => {
    console.log(
      `Simulating code navigation/analysis for type: '${input.type}'`
    );
    return { result: `Simulated analysis result for ${input.type}` };
  }
);

const agenticTaskPlanningPrompt = ai.definePrompt({
  name: 'agenticTaskPlanningPrompt',
  input: { schema: AgenticTaskPlanningInputSchema },
  output: { schema: AgenticTaskPlanningOutputSchema },
  tools: [fileReadingTool, codeSearchTool, codeNavigationAnalysisTool],
  prompt: `You are an expert AI agent specialized in planning software development tasks. Your primary role is to analyze a given development task and generate a detailed, step-by-step action plan using the available tools.

Each step in your plan should be clear and concise. If a tool is required for a step, you must specify its name and provide the exact toolInput as a JSON object.

**Available Tools:**

1.  **fileReadingTool**
    -   **Description:** Reads the content of a specific file.
    -   **Input Schema:** {"filePath": "string"}

2.  **codeSearchTool**
    -   **Description:** Performs contextual search.
    -   **Input Schema:** {"query": "string", "fileFilter": "string (optional)"}

3.  **codeNavigationAnalysisTool**
    -   **Description:** Provides code navigation.
    -   **Input Schema:** {"type": "go_to_definition" | "analyze_semantics"}

**User's Development Task:** {{{developmentTask}}}

Your response should be a JSON array of objects representing steps. Each object must contain a 'step' string.`,
});

const agenticTaskPlanningFlow = ai.defineFlow(
  {
    name: 'agenticTaskPlanningFlow',
    inputSchema: AgenticTaskPlanningInputSchema,
    outputSchema: AgenticTaskPlanningOutputSchema,
  },
  async (input) => {
    const { output } = await agenticTaskPlanningPrompt(input);
    if (!output) {
      throw new Error('Failed to generate a valid plan from Ollama.');
    }
    return output;
  }
);

export async function agenticTaskPlanning(
  input: AgenticTaskPlanningInput
): Promise<AgenticTaskPlanningOutput> {
  return agenticTaskPlanningFlow(input);
}
