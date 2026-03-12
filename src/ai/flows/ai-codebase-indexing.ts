'use server';
/**
 * @fileOverview This file implements the Genkit flow for indexing a project codebase.
 *
 * - aiCodebaseIndexing - A function that orchestrates the project indexing process.
 * - ProjectIndexingInput - The input type for the aiCodebaseIndexing function.
 * - ProjectIndexingOutput - The return type for the aiCodebaseIndexing function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Input schema for the aiCodebaseIndexing flow.
 * @property {string} projectPath - The absolute path to the project directory to be indexed.
 */
const ProjectIndexingInputSchema = z.object({
  projectPath: z.string().describe('The absolute path to the project directory to be indexed.'),
});
export type ProjectIndexingInput = z.infer<typeof ProjectIndexingInputSchema>;

/**
 * Output schema for the aiCodebaseIndexing flow.
 * An array of indexed file details.
 */
const ProjectIndexingOutputSchema = z.array(
  z.object({
    filePath: z.string().describe('The relative path of the indexed file within the project.'),
    semanticSummary: z.string().describe('A semantic summary of the file content, optimized for AI understanding.'),
  })
);
export type ProjectIndexingOutput = z.infer<typeof ProjectIndexingOutputSchema>;

/**
 * Genkit tool to recursively read all relevant code files from a given project directory.
 * It filters out common ignored folders (e.g., node_modules, .git) and binary file extensions.
 */
const readProjectFilesTool = ai.defineTool(
  {
    name: 'readProjectFiles',
    description: 'Recursively reads all relevant code files from a given project directory, excluding common ignored files and binary files.',
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
    const ignoreFolders = ['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', 'public', '.vscode'];
    const ignoreExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', // Images
      '.zip', '.tar', '.gz', '.rar', '.7z', // Archives
      '.pdf', '.docx', '.xlsx', '.pptx', // Documents
      '.mp3', '.wav', '.ogg', '.flac', // Audio
      '.mp4', '.avi', '.mkv', '.mov', // Video
      '.exe', '.dll', '.bin', '.obj', '.class', // Binaries
      '.log', '.tmp', '.DS_Store', // Logs, temporary, and system files
      '.lock', // Package manager lock files
      '.woff', '.woff2', '.ttf', '.otf', // Fonts
      '.eot', // Embedded OpenType fonts
    ];

    async function walk(currentDirPath: string) {
      let entries;
      try {
        entries = await fs.readdir(currentDirPath, { withFileTypes: true });
      } catch (error) {
        // console.warn(`Could not read directory ${currentDirPath}: ${error}`);
        return; // Skip directories we can't read or access
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDirPath, entry.name);
        if (entry.isDirectory()) {
          // Ignore dot-directories and specified ignoreFolders
          if (!entry.name.startsWith('.') && !ignoreFolders.includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const fileExtension = path.extname(entry.name).toLowerCase();
          // Ignore dot-files and specified ignoreExtensions
          if (!entry.name.startsWith('.') && !ignoreExtensions.includes(fileExtension)) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              filesToProcess.push({ filePath: fullPath, content });
            } catch (readError) {
              console.warn(`Could not read file ${fullPath}: ${readError}`);
            }
          }
        }
      }
    }
    await walk(input.directoryPath);
    return filesToProcess;
  }
);

/**
 * Genkit prompt to generate a semantic summary of a code file.
 * The summary is optimized for AI agents to understand the file's role and content.
 */
const summarizeCodeFilePrompt = ai.definePrompt({
  name: 'summarizeCodeFilePrompt',
  input: {
    schema: z.object({
      filePath: z.string().describe('The relative path of the code file.'),
      fileContent: z.string().describe('The full content of the code file.'),
    }),
  },
  output: {
    schema: z.object({
      semanticSummary: z.string().describe('A concise semantic summary of the code file, highlighting its purpose, main functionalities, key dependencies, and any important interfaces or classes it defines. This summary should be optimized for an AI agent to quickly understand the file\'s role and content in the larger codebase context.'),
    }),
  },
  prompt: `You are an expert AI assistant specializing in understanding and summarizing codebases.
Your task is to provide a concise semantic summary of the provided code file.
The summary should enable an AI agent to quickly understand the file's purpose, its main functionalities, key dependencies (e.g., imports), and any important interfaces, classes, or functions it defines.
Focus on the 'what' and 'why' of the code rather than a line-by-line explanation.

File Path: {{{filePath}}}

--- File Content ---
{{{fileContent}}}
--- End File Content ---

Please provide your summary in JSON format with a single key 'semanticSummary'.`,
});

/**
 * Genkit flow to perform AI-driven codebase indexing.
 * It reads all relevant files from a project and generates a semantic summary for each using an LLM.
 */
const aiCodebaseIndexingFlow = ai.defineFlow(
  {
    name: 'aiCodebaseIndexingFlow',
    inputSchema: ProjectIndexingInputSchema,
    outputSchema: ProjectIndexingOutputSchema,
  },
  async (input) => {
    // 1. Read all relevant files using the defined tool
    const allFilesWithContent = await readProjectFilesTool({ directoryPath: input.projectPath });

    const indexedFiles: z.infer<typeof ProjectIndexingOutputSchema> = [];

    // 2. Process each file to get a semantic summary using the LLM prompt
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
        // If an error occurs during summarization, skip this file but continue with others.
      }
    }

    return indexedFiles;
  }
);

/**
 * Wrapper function to execute the AI codebase indexing flow.
 * @param {ProjectIndexingInput} input - The input containing the project path.
 * @returns {Promise<ProjectIndexingOutput>} A promise that resolves to the indexed files with their semantic summaries.
 */
export async function aiCodebaseIndexing(input: ProjectIndexingInput): Promise<ProjectIndexingOutput> {
  return aiCodebaseIndexingFlow(input);
}
