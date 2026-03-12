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

// ===========================================================================
// Tool Definitions
// These tools are defined for the LLM to understand their capabilities
// and plan their usage. Their actual execution is handled outside this flow.
// ===========================================================================

// Tool to read the content of a file
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
    // Dummy implementation for planning purposes.
    // In a real application, this would interface with a file system service.
    console.log(`Simulating file read for: ${input.filePath}`);
    return { content: `Content of ${input.filePath} (simulated data)` };
  }
);

// Tool for contextual and semantic code search
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
    // Dummy implementation for planning purposes.
    console.log(
      `Simulating code search for query: '${input.query}' with filter: '${input.fileFilter || 'none'}'`
    );
    return [
      {
        filePath: 'src/components/feature.ts',
        snippet: 'class FeatureComponent { /* ... */ }',
      },
    ];
  }
);

// Tool for code navigation and semantic analysis
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
          'The specific location in the code for go_to_definition (if type is go_to_definition).'
        ),
      symbol: z
        .string()
        .optional()
        .describe('The symbol to analyze for semantic analysis (if type is analyze_semantics).'),
    }),
    outputSchema: z
      .object({
        result: z.any().describe('The result of the navigation or analysis operation.'),
      })
      .describe('The result of the navigation or analysis operation.'),
  },
  async (input) => {
    // Dummy implementation for planning purposes.
    console.log(
      `Simulating code navigation/analysis for type: '${input.type}'`
    );
    return { result: `Simulated analysis result for ${input.type}` };
  }
);

// Genkit Prompt definition for the task planning agent
const agenticTaskPlanningPrompt = ai.definePrompt({
  name: 'agenticTaskPlanningPrompt',
  input: { schema: AgenticTaskPlanningInputSchema },
  output: { schema: AgenticTaskPlanningOutputSchema },
  tools: [fileReadingTool, codeSearchTool, codeNavigationAnalysisTool], // Register tools with the prompt
  prompt: `You are an expert AI agent specialized in planning software development tasks. Your primary role is to analyze a given development task and generate a detailed, step-by-step action plan using the available tools.

Each step in your plan should be clear and concise. If a tool is required for a step, you must specify its 'name' and provide the exact 'toolInput' as a JSON object, ensuring it conforms to the tool's expected input schema. Do not invent tools or parameters; use only the tools listed below.

**Available Tools:**

1.  **fileReadingTool**
    -   **Description:** Reads the content of a specific file within the project.
    -   **Input Schema:** 
        \`\`\`json
        {"filePath": "string"}
        \`\`\`

2.  **codeSearchTool**
    -   **Description:** Performs a contextual and semantic search within the project's codebase to find relevant code snippets or definitions.
    -   **Input Schema:** 
        \`\`\`json
        {"query": "string", "fileFilter": "string (optional)"}
        \`\`\`

3.  **codeNavigationAnalysisTool**
    -   **Description:** Provides advanced code navigation (e.g., go to definition) and semantic analysis for code understanding.
    -   **Input Schema:** 
        \`\`\`json
        {"type": "go_to_definition" | "analyze_semantics", "target": {"filePath": "string", "lineNumber": "number", "columnNumber": "number"} (optional), "symbol": "string (optional)"}
        \`\`\`

**User's Development Task:** {{{developmentTask}}}

Your response should be a JSON array of objects, where each object represents a step in the plan and must contain a 'step' string. Optionally, if a tool is used, it should also contain a 'tool' string and a 'toolInput' object. Example:

\`\`\`json
[
  {
    "step": "Understand the core requirements."
  },
  {
    "step": "Search for existing relevant code related to user authentication.",
    "tool": "codeSearchTool",
    "toolInput": {
      "query": "user authentication flow",
      "fileFilter": "src/auth/**.ts"
    }
  },
  {
    "step": "Read the main authentication service file.",
    "tool": "fileReadingTool",
    "toolInput": {
      "filePath": "src/auth/auth.service.ts"
    }
  },
  {
    "step": "Implement the new feature."
  }
]
\`\`\`
`,
});

// Genkit Flow definition to execute the planning prompt
const agenticTaskPlanningFlow = ai.defineFlow(
  {
    name: 'agenticTaskPlanningFlow',
    inputSchema: AgenticTaskPlanningInputSchema,
    outputSchema: AgenticTaskPlanningOutputSchema,
  },
  async (input) => {
    // Call the prompt with the user's development task
    const { output } = await agenticTaskPlanningPrompt(input);
    if (!output) {
      throw new Error('Failed to generate a valid plan from the LLM.');
    }
    return output;
  }
);

/**
 * Generates a step-by-step plan for a given development task using AI agents and available tools.
 * @param input - An object containing the development task description.
 * @returns A promise that resolves to the generated step-by-step plan.
 */
export async function agenticTaskPlanning(
  input: AgenticTaskPlanningInput
): Promise<AgenticTaskPlanningOutput> {
  return agenticTaskPlanningFlow(input);
}