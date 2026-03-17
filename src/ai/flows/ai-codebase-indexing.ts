'use server';
/**
 * @fileOverview Gestione dell'indicizzazione semantica del codebase con supporto per file grandi.
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
  console.log(`[INDEXER] Salvataggio completato: ${indexData.length} file scritti in ${projectName}.json`);
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
  const MAX_FILE_SIZE = 500 * 1024; 
  
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
        const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.php', '.py', '.html', '.sql', '.yaml', '.yml', '.blade.php'];
        
        if ((validExts.includes(fileExtension) || entry.name.endsWith('.blade.php')) && !ignoreFiles.includes(entry.name)) {
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

const summarizeFilePrompt = ai.definePrompt({
  name: 'summarizeFilePrompt',
  input: {
    schema: z.object({
      filePath: z.string(),
      content: z.string(),
    }),
  },
  output: { format: 'text' },
  prompt: `Riassumi lo scopo di questo file in una breve frase tecnica (max 20 parole). 
  Scrivi solo il riassunto.

  File: {{{filePath}}}
  Contenuto:
  {{{content}}}`,
});

const summarizeLargeFileChunksPrompt = ai.definePrompt({
  name: 'summarizeLargeFileChunksPrompt',
  input: {
    schema: z.object({
      filePath: z.string(),
      chunks: z.array(z.string()),
    }),
  },
  output: { format: 'text' },
  prompt: `Riassumi lo scopo di questo file di grandi dimensioni analizzando questi frammenti estratti dall'inizio, dal centro e dalla fine del file.
  
  File: {{{filePath}}}
  
  Frammenti estratti:
  {{#each chunks}}
  --- Pezzo {{@index}} ---
  {{{this}}}
  {{/each}}
  
  Scrivi un riassunto tecnico coerente di massimo 25 parole.`,
});

export async function indexFileSemantic(input: { projectPath: string, relativeFilePath: string }) {
  const fullPath = path.join(input.projectPath, input.relativeFilePath);
  let result;
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    let summary = "";
    
    if (content.length <= 4000) {
      const { text } = await summarizeFilePrompt({
        filePath: input.relativeFilePath,
        content,
      });
      summary = text?.trim() || "File sorgente del progetto.";
    } else {
      const chunkSize = 2000;
      const chunks = [
        content.substring(0, chunkSize),
        content.substring(Math.floor(content.length / 2) - chunkSize / 2, Math.floor(content.length / 2) + chunkSize / 2),
        content.substring(content.length - chunkSize)
      ];

      const { text } = await summarizeLargeFileChunksPrompt({
        filePath: input.relativeFilePath,
        chunks,
      });
      summary = text?.trim() || "File di grandi dimensioni del progetto.";
    }

    result = {
      filePath: input.relativeFilePath,
      semanticSummary: summary,
    };

  } catch (error) {
    result = {
      filePath: input.relativeFilePath,
      semanticSummary: "Analisi non riuscita o file binario.",
    };
  }

  // LOG A TERMINALE RICHIESTO DALL'UTENTE
  console.log(`[INDEXER-RESULT]`, JSON.stringify(result, null, 2));
  
  return result;
}
