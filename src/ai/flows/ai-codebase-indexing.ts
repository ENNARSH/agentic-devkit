
'use server';
/**
 * @fileOverview This file implements the Genkit flow for indexing a project codebase using Ollama.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

const ProjectIndexingInputSchema = z.object({
  projectPath: z.string().describe('The absolute path to the project directory to be indexed.'),
});
export type ProjectIndexingInput = z.infer<typeof ProjectIndexingInputSchema>;

const ProjectIndexingOutputSchema = z.array(
  z.object({
    filePath: z.string().describe('The relative path of the indexed file.'),
    semanticSummary: z.string().describe('A semantic summary of the file content.'),
  })
);
export type ProjectIndexingOutput = z.infer<typeof ProjectIndexingOutputSchema>;

const readProjectFilesTool = ai.defineTool(
  {
    name: 'readProjectFiles',
    description: 'Recursively reads code files.',
    inputSchema: z.object({
      directoryPath: z.string().describe('The absolute path to the directory.'),
    }),
    outputSchema: z.array(
      z.object({
        filePath: z.string().describe('The absolute path to the file.'),
        content: z.string().describe('The content of the file.'),
      })
    ),
  },
  async (input) => {
    const filesToProcess: { filePath: string; content: string }[] = [];
    const ignoreFolders = ['node_modules', '.git', '.next', 'dist', 'build'];
    
    async function walk(currentDirPath: string) {
      let entries;
      try {
        entries = await fs.readdir(currentDirPath, { withFileTypes: true });
      } catch (error) {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDirPath, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && !ignoreFolders.includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const fileExtension = path.extname(entry.name).toLowerCase();
          const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css'];
          if (validExts.includes(fileExtension)) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              filesToProcess.push({ filePath: fullPath, content });
            } catch (readError) {}
          }
        }
      }
    }
    await walk(input.directoryPath);
    return filesToProcess;
  }
);

const summarizeCodeFilePrompt = ai.definePrompt({
  name: 'summarizeCodeFilePrompt',
  input: {
    schema: z.object({
      filePath: z.string(),
      fileContent: z.string(),
    }),
  },
  output: {
    schema: z.object({
      semanticSummary: z.string(),
    }),
  },
  prompt: `You are an expert AI assistant specialized in summarizing codebases.
Provide a concise semantic summary of the provided code file. Focus on what it does and why.

File Path: {{{filePath}}}

--- File Content ---
{{{fileContent}}}
--- End File Content ---

Return JSON with 'semanticSummary' key.`,
});

const aiCodebaseIndexingFlow = ai.defineFlow(
  {
    name: 'aiCodebaseIndexingFlow',
    inputSchema: ProjectIndexingInputSchema,
    outputSchema: ProjectIndexingOutputSchema,
  },
  async (input) => {
    const allFilesWithContent = await readProjectFilesTool({ directoryPath: input.projectPath });
    const indexedFiles: z.infer<typeof ProjectIndexingOutputSchema> = [];

    for (const file of allFilesWithContent) {
      try {
        const relativeFilePath = path.relative(input.projectPath, file.filePath);
        const { output } = await summarizeCodeFilePrompt({
          filePath: relativeFilePath,
          fileContent: file.content,
        });
        indexedFiles.push({
          filePath: relativeFilePath,
          semanticSummary: output!.semanticSummary,
        });
      } catch (promptError) {
        console.error(`Error summarizing file ${file.filePath}: ${promptError}`);
      }
    }

    return indexedFiles;
  }
);

export async function aiCodebaseIndexing(input: ProjectIndexingInput): Promise<ProjectIndexingOutput> {
  return aiCodebaseIndexingFlow(input);
}
