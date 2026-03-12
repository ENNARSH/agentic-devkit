'use server';
/**
 * @fileOverview This file implements the Genkit flow for indexing a project codebase using Ollama.
 * Handles file scanning, semantic summarization, and local persistence.
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

const INDEX_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'project-index.json');

/**
 * Ensures the data directory exists.
 */
async function ensureDataDir() {
  const dataDir = path.dirname(INDEX_CACHE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

/**
 * Saves the indexed results to a local JSON file.
 */
export async function saveProjectIndex(indexData: any[]) {
  await ensureDataDir();
  await fs.writeFile(INDEX_CACHE_PATH, JSON.stringify(indexData, null, 2), 'utf-8');
  console.log(`[INDEXER] Indice salvato con successo in ${INDEX_CACHE_PATH}`);
}

/**
 * Loads the indexed results from the local JSON file.
 */
export async function loadProjectIndex(): Promise<any[]> {
  try {
    const data = await fs.readFile(INDEX_CACHE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Gets a list of relative file paths to be indexed.
 */
export async function getFilesToProcess(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  const ignoreFolders = ['node_modules', '.git', '.next', 'dist', 'build', '.firebase', 'out'];
  const ignoreFiles = ['package-lock.json', 'yarn.lock', 'composer.lock', 'pnpm-lock.yaml'];
  const MAX_FILE_SIZE = 30 * 1024; // 30KB limit
  
  async function walk(currentDirPath: string) {
    let entries;
    try {
      entries = await fs.readdir(currentDirPath, { withFileTypes: true });
    } catch (error) {
      console.error(`[INDEXER] Errore lettura directory ${currentDirPath}:`, error);
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
            }
          } catch (e) {
            // Skip
          }
        }
      }
    }
  }
  
  console.log(`[INDEXER] Avvio scansione progetto: ${projectPath}`);
  await walk(projectPath);
  console.log(`[INDEXER] Scansione completata. Trovati ${files.length} file validi.`);
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
  prompt: `You are a professional software engineer. Provide a 1-sentence summary of the following file.

File Path: {{{filePath}}}
Content:
{{{fileContent}}}

INSTRUCTIONS:
1. Provide ONLY a JSON object.
2. Do NOT provide the JSON schema definition.
3. Use exactly this format: {"semanticSummary": "your summary here"}
4. The summary must be a single short sentence.`,
});

export async function indexFileSemantic(input: z.infer<typeof FileIndexingInputSchema>): Promise<z.infer<typeof SingleFileSummarySchema>> {
  const fullPath = path.join(input.projectPath, input.relativeFilePath);
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const truncatedContent = content.length > 3000 ? content.substring(0, 3000) + "...[truncated]" : content;
    
    console.log(`[INDEXER] Elaborazione ${input.relativeFilePath}...`);
    
    // Use a try-catch for the specific AI call to prevent one file from crashing the whole process
    try {
      const { output } = await summarizeCodeFilePrompt({
        filePath: input.relativeFilePath,
        fileContent: truncatedContent,
      });

      if (!output || !output.semanticSummary) {
        throw new Error('Missing semanticSummary in response');
      }

      return {
        filePath: input.relativeFilePath,
        semanticSummary: output.semanticSummary,
      };
    } catch (aiError) {
      console.warn(`[INDEXER] Fallimento AI su ${input.relativeFilePath}, uso fallback.`);
      return {
        filePath: input.relativeFilePath,
        semanticSummary: `File ${path.extname(input.relativeFilePath)} nel progetto.`,
      };
    }
  } catch (error) {
    console.error(`[INDEXER] ERRORE lettura file ${input.relativeFilePath}:`, error);
    return {
      filePath: input.relativeFilePath,
      semanticSummary: "Error reading file content.",
    };
  }
}
