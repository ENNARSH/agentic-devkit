'use server';
/**
 * @fileOverview Gestione dell'indicizzazione semantica del codebase.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

const INDEX_DATA_DIR = path.join(process.cwd(), 'src', 'data');

async function ensureDataDir() {
  try {
    await fs.access(INDEX_DATA_DIR);
  } catch {
    await fs.mkdir(INDEX_DATA_DIR, { recursive: true });
  }
}

export async function listIndexedProjects() {
  await ensureDataDir();
  try {
    const files = await fs.readdir(INDEX_DATA_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f.replace('.json', ''),
        fileName: f
      }));
  } catch {
    return [];
  }
}

export async function saveProjectIndex(indexData: any[], projectName: string = 'project-index') {
  await ensureDataDir();
  const filePath = path.join(INDEX_DATA_DIR, `${projectName}.json`);
  await fs.writeFile(filePath, JSON.stringify(indexData, null, 2), 'utf-8');
}

export async function loadProjectIndex(projectName: string = 'project-index'): Promise<any[]> {
  try {
    const filePath = path.join(INDEX_DATA_DIR, `${projectName}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function getFilesToProcess(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  const ignoreFolders = ['node_modules', '.git', '.next', 'dist', 'build', '.firebase', 'out', 'vendor', 'storage', 'public/vendor'];
  const ignoreFiles = ['package-lock.json', 'yarn.lock', 'composer.lock', 'pnpm-lock.yaml', '.env', 'favicon.ico', '.DS_Store'];
  const MAX_FILE_SIZE = 100 * 1024; // 100KB
  
  async function walk(currentDirPath: string) {
    let entries;
    try {
      entries = await fs.readdir(currentDirPath, { withFileTypes: true });
    } catch (error) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirPath, entry.name);
      const relativePath = path.relative(projectPath, fullPath);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !ignoreFolders.includes(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const fileExtension = path.extname(entry.name).toLowerCase();
        const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.php', '.py', '.html', '.sql', '.yaml', '.yml'];
        
        if (validExts.includes(fileExtension) && !ignoreFiles.includes(entry.name)) {
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size <= MAX_FILE_SIZE) {
              files.push(relativePath);
            }
          } catch (e) {}
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
  output: { format: 'text' },
  prompt: `Riassumi lo scopo di questo file in una singola breve frase (max 15 parole). 
  NON restituire schemi JSON o markdown, scrivi solo il riassunto.

  File: {{{filePath}}}
  Contenuto:
  {{{fileContent}}}`,
});

export async function indexFileSemantic(input: { projectPath: string, relativeFilePath: string }) {
  const fullPath = path.join(input.projectPath, input.relativeFilePath);
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const truncatedContent = content.length > 3000 ? content.substring(0, 3000) : content;
    const { text } = await summarizeCodeFilePrompt({
      filePath: input.relativeFilePath,
      fileContent: truncatedContent,
    });
    return {
      filePath: input.relativeFilePath,
      semanticSummary: text?.trim() || "File sorgente del progetto.",
    };
  } catch (error) {
    return {
      filePath: input.relativeFilePath,
      semanticSummary: "File di codice.",
    };
  }
}
