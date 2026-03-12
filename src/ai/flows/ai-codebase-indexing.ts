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
  const ignoreFolders = ['node_modules', '.git', '.next', 'dist', 'build', '.firebase', 'out', 'vendor', 'storage', 'public/vendor'];
  const ignoreFiles = ['package-lock.json', 'yarn.lock', 'composer.lock', 'pnpm-lock.yaml', '.env', 'favicon.ico', '.DS_Store'];
  const MAX_FILE_SIZE = 50 * 1024; // 50KB per stabilità
  
  console.log(`[INDEXER] Avvio scansione progetto: ${projectPath}`);
  
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
      const relativePath = path.relative(projectPath, fullPath);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !ignoreFolders.includes(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const fileExtension = path.extname(entry.name).toLowerCase();
        const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.php', '.py', '.html', '.sql', '.yaml', '.yml'];
        
        if (validExts.includes(fileExtension)) {
          if (ignoreFiles.includes(entry.name)) {
            continue;
          }
          
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size <= MAX_FILE_SIZE) {
              files.push(relativePath);
            }
          } catch (e) {
            // Ignora file non accessibili
          }
        }
      }
    }
  }
  
  await walk(projectPath);
  console.log(`[INDEXER] Scansione completata. Trovati ${files.length} file indicizzabili.`);
  return files;
}

// Usiamo output di testo semplice per evitare confusione dello schema JSON in Ollama
const summarizeCodeFilePrompt = ai.definePrompt({
  name: 'summarizeCodeFilePrompt',
  input: {
    schema: z.object({
      filePath: z.string(),
      fileContent: z.string(),
    }),
  },
  output: {
    format: 'text',
  },
  prompt: `Riassumi lo scopo di questo file in una singola breve frase (max 15 parole).
Non aggiungere introduzioni, non usare markdown, scrivi solo il riassunto.

File: {{{filePath}}}
Contenuto:
{{{fileContent}}}`,
});

export async function indexFileSemantic(input: z.infer<typeof FileIndexingInputSchema>): Promise<z.infer<typeof SingleFileSummarySchema>> {
  const fullPath = path.join(input.projectPath, input.relativeFilePath);
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const truncatedContent = content.length > 2000 ? content.substring(0, 2000) : content;
    
    console.log(`[INDEXER] Analisi: ${input.relativeFilePath}`);
    
    try {
      const { text } = await summarizeCodeFilePrompt({
        filePath: input.relativeFilePath,
        fileContent: truncatedContent,
      });

      const summary = text?.trim() || `File sorgente ${path.extname(input.relativeFilePath)}.`;

      return {
        filePath: input.relativeFilePath,
        semanticSummary: summary,
      };
    } catch (aiError) {
      console.warn(`[INDEXER] Errore AI per ${input.relativeFilePath}, uso fallback.`);
      return {
        filePath: input.relativeFilePath,
        semanticSummary: `File sorgente nel progetto.`,
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
