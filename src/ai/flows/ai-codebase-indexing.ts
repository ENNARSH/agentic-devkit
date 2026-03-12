'use server';
/**
 * @fileOverview Gestione dell'indicizzazione semantica del codebase.
 * Salva i risultati in src/data/project-index.json per persistenza locale.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';

const ProjectIndexingInputSchema = z.object({
  projectPath: z.string(),
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

async function ensureDataDir() {
  const dataDir = path.dirname(INDEX_CACHE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

export async function saveProjectIndex(indexData: any[]) {
  await ensureDataDir();
  await fs.writeFile(INDEX_CACHE_PATH, JSON.stringify(indexData, null, 2), 'utf-8');
  console.log(`[INDEXER] Indice aggiornato: ${indexData.length} file salvati.`);
}

export async function loadProjectIndex(): Promise<any[]> {
  try {
    const data = await fs.readFile(INDEX_CACHE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function getFilesToProcess(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  const ignoreFolders = ['node_modules', '.git', '.next', 'dist', 'build', '.firebase', 'out', 'vendor'];
  const ignoreFiles = ['package-lock.json', 'yarn.lock', 'composer.lock', 'pnpm-lock.yaml', '.env', 'favicon.ico'];
  const MAX_FILE_SIZE = 30 * 1024; // 30KB
  
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
        const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.php', '.py'];
        
        if (validExts.includes(fileExtension) && !ignoreFiles.includes(entry.name)) {
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size <= MAX_FILE_SIZE) {
              files.push(path.relative(projectPath, fullPath));
            }
          } catch (e) {
            // Ignora file non accessibili
          }
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
  prompt: `Sei un ingegnere del software esperto. Riassumi lo scopo del file seguente in UNA SOLA BREVE FRASE.

Percorso File: {{{filePath}}}
Contenuto:
{{{fileContent}}}

ISTRUZIONI TASSATIVE:
1. Restituisci SOLO un oggetto JSON valido.
2. NON includere descrizioni del formato o schemi.
3. Formato: {"semanticSummary": "la tua descrizione qui"}
4. Se non riesci a capire il file, scrivi "File sorgente del progetto."`,
});

export async function indexFileSemantic(input: z.infer<typeof FileIndexingInputSchema>): Promise<z.infer<typeof SingleFileSummarySchema>> {
  const fullPath = path.join(input.projectPath, input.relativeFilePath);
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const truncatedContent = content.length > 3000 ? content.substring(0, 3000) + "...[troncato]" : content;
    
    console.log(`[INDEXER] Analisi: ${input.relativeFilePath}`);
    
    try {
      const { output } = await summarizeCodeFilePrompt({
        filePath: input.relativeFilePath,
        fileContent: truncatedContent,
      });

      if (!output || !output.semanticSummary) {
        throw new Error('Risposta AI malformata');
      }

      return {
        filePath: input.relativeFilePath,
        semanticSummary: output.semanticSummary,
      };
    } catch (aiError) {
      console.warn(`[INDEXER] Fallback per ${input.relativeFilePath}`);
      return {
        filePath: input.relativeFilePath,
        semanticSummary: `File sorgente ${path.extname(input.relativeFilePath)} nel progetto.`,
      };
    }
  } catch (error) {
    console.error(`[INDEXER] Errore lettura ${input.relativeFilePath}:`, error);
    return {
      filePath: input.relativeFilePath,
      semanticSummary: "Errore durante la lettura del file.",
    };
  }
}
