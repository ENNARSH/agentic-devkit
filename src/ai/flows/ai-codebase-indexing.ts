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
  let totalFilesSeen = 0;
  const ignoreFolders = [
    'node_modules', '.git', '.next', 'dist', 'build', '.firebase', 'out', 
    'vendor', 'storage', 'tmp', 'logs', 'obj', 'bin'
  ];
  const ignoreFiles = [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store', '.gitignore'
  ];
  const MAX_FILE_SIZE = 1024 * 1024; // Aumentato a 1MB per gestire file JS grandi
  
  async function walk(currentDirPath: string) {
    let entries;
    try { entries = await fs.readdir(currentDirPath, { withFileTypes: true }); } catch (error) { return; }

    for (const entry of entries) {
      totalFilesSeen++;
      const fullPath = path.join(currentDirPath, entry.name);
      const relativePath = path.relative(projectPath, fullPath);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !ignoreFolders.includes(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const fileExtension = path.extname(entry.name).toLowerCase();
        const validExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.php', '.py', '.html', '.sh', '.yaml'];
        
        if (validExts.includes(fileExtension) && !ignoreFiles.includes(entry.name)) {
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size <= MAX_FILE_SIZE) files.push(relativePath);
          } catch (e) {}
        }
      }
    }
  }
  
  console.log(`[INDEXER] Scansione avviata in: ${projectPath}...`);
  await walk(projectPath);
  console.log(`[INDEXER] Scansione completata. File totali: ${totalFilesSeen}. Selezionati per analisi: ${files.length}.`);
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
  Se il file è molto grande, indica che è un file principale da spezzettare.

  File: {{{filePath}}}
  Contenuto:
  {{{content}}}`,
});

export async function indexFileSemantic(input: { projectPath: string, relativeFilePath: string }) {
  const fullPath = path.join(input.projectPath, input.relativeFilePath);
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    let summary = "";
    
    // Per file molto grandi usiamo un campionamento più aggressivo
    const sample = content.length > 5000 ? content.substring(0, 3000) + "\n...[FILE GRANDE]..." : content;

    const { text } = await summarizeFilePrompt({
      filePath: input.relativeFilePath,
      content: sample,
    });
    summary = text?.trim() || "File sorgente del progetto.";

    const result = { filePath: input.relativeFilePath, semanticSummary: summary };
    console.log(`[INDEXER-RESULT]`, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    return { filePath: input.relativeFilePath, semanticSummary: "Errore analisi." };
  }
}
