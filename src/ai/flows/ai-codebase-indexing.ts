
'use server';
/**
 * @fileOverview This file implements the Genkit flow for indexing a project codebase using Ollama.
 * Updated to skip large files and lock files to prevent "fetch failed" errors.
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
 * Filters out lock files and files that are too large.
 */
export async function getFilesToProcess(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  const ignoreFolders = ['node_modules', '.git', '.next', 'dist', 'build', '.firebase', 'out'];
  const ignoreFiles = ['package-lock.json', 'yarn.lock', 'composer.lock', 'pnpm-lock.yaml'];
  const MAX_FILE_SIZE = 50 * 1024; // 50KB limit for local AI processing
  
  async function walk(currentDirPath: string) {
    let entries;
    try {
      entries = await fs.readdir(currentDirPath, { withFileTypes: true });
    } catch (error) {
      console.error(`Error reading directory ${currentDirPath}:`, error);
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
        
        if (validExts.includes(fileExtension) && !ignoreFiles.includes(entry.name)) {
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size <= MAX_FILE_SIZE) {
              files.push(path.relative(projectPath, fullPath));
            } else {
              console.log(`Skipping large file: ${entry.name} (${Math.round(stats.size/1024)}KB)`);
            }
          } catch (e) {
            console.error(`Could not stat file: ${fullPath}`);
          }
        }
      }
    }
  }
  
  console.log(`Scanning project directory: ${projectPath}`);
  await walk(projectPath);
  console.log(`Scan complete. Found ${files.length} indexable files.`);
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
  prompt: `Provide a 1-sentence summary of this file. Focus on its main responsibility.
File: {{{filePath}}}
Content:
{{{fileContent}}}`,
});

/**
 * Indexes a single file and returns its summary.
 */
export async function indexFileSemantic(input: z.infer<typeof FileIndexingInputSchema>): Promise<z.infer<typeof SingleFileSummarySchema>> {
  const fullPath = path.join(input.projectPath, input.relativeFilePath);
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    // Ensure we don't send massive content even if file passed size check
    const truncatedContent = content.length > 10000 ? content.substring(0, 10000) + "...[truncated]" : content;
    
    console.log(`Ollama: Summarizing ${input.relativeFilePath}...`);
    
    const { output } = await summarizeCodeFilePrompt({
      filePath: input.relativeFilePath,
      fileContent: truncatedContent,
    });

    if (!output) {
      return {
        filePath: input.relativeFilePath,
        semanticSummary: "Ollama returned an empty response for this file.",
      };
    }

    return {
      filePath: input.relativeFilePath,
      semanticSummary: output.semanticSummary,
    };
  } catch (error) {
    console.error(`Error processing ${input.relativeFilePath}:`, error);
    return {
      filePath: input.relativeFilePath,
      semanticSummary: "Skipped due to error or timeout.",
    };
  }
}
