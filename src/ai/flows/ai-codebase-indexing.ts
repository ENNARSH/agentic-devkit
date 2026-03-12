
'use server';
/**
 * @fileOverview This file implements the Genkit flow for indexing a project codebase using Ollama.
 * Updated to support granular indexing for progress reporting.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

const ProjectIndexingInputSchema = z.object({
  projectPath: z.string().describe('The absolute path to the project directory to be indexed.'),
});

const FileIndexingInputSchema = z.object({
  projectPath: z.string(),
  relativeFilePath: z.string(),
});

const SingleFileSummarySchema = z.object({
  filePath: z.string(),
  semanticSummary: z.string(),
});

/**
 * Gets a list of relative file paths to be indexed.
 */
export async function getFilesToProcess(projectPath: string): Promise<string[]> {
  const files: string[] = [];
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
          files.push(path.relative(projectPath, fullPath));
        }
      }
    }
  }
  
  await walk(projectPath);
  return files;
}

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

/**
 * Indexes a single file and returns its summary.
 */
export async function indexFileSemantic(input: z.infer<typeof FileIndexingInputSchema>): Promise<z.infer<typeof SingleFileSummarySchema>> {
  const fullPath = path.join(input.projectPath, input.relativeFilePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  
  const { output } = await summarizeCodeFilePrompt({
    filePath: input.relativeFilePath,
    fileContent: content,
  });

  return {
    filePath: input.relativeFilePath,
    semanticSummary: output!.semanticSummary,
  };
}

// Keeping the original flow for compatibility if needed
export async function aiCodebaseIndexing(input: z.infer<typeof ProjectIndexingInputSchema>) {
  const files = await getFilesToProcess(input.projectPath);
  const results = [];
  for (const file of files) {
    const summary = await indexFileSemantic({ projectPath: input.projectPath, relativeFilePath: file });
    results.push(summary);
  }
  return results;
}
