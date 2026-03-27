'use server';
/**
 * @fileOverview Flow agentico ottimizzato per file di grandi dimensioni e refactoring strutturato.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { loadProjectIndex, listIndexedProjects } from './ai-codebase-indexing';
import * as fs from 'fs/promises';
import * as path from 'path';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

const getFileInfoTool = ai.defineTool(
  {
    name: 'getFileInfo',
    description: 'Ottiene metadati su un file (dimensione, numero di righe). USALO su file molto grandi prima di leggerli.',
    inputSchema: z.object({
      filePath: z.string().describe('Percorso relativo del file.'),
    }),
    outputSchema: z.object({
      size: z.number(),
      lineCount: z.number(),
      readable: z.boolean(),
    }),
  },
  async (input, { context }) => {
    const projectPath = (context as any)?.projectPath;
    if (!projectPath) return { size: 0, lineCount: 0, readable: false };
    
    try {
      const fullPath = path.join(projectPath, input.filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      return {
        size: content.length,
        lineCount: lines.length,
        readable: true
      };
    } catch (e) {
      return { size: 0, lineCount: 0, readable: false };
    }
  }
);

const readFileLinesTool = ai.defineTool(
  {
    name: 'readFileLines',
    description: 'Legge un range specifico di righe da un file. Utile per processare file enormi pezzo per pezzo.',
    inputSchema: z.object({
      filePath: z.string().describe('Percorso relativo del file.'),
      startLine: z.number().describe('Riga di inizio (base 1).'),
      endLine: z.number().describe('Riga di fine.'),
    }),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    const projectPath = (context as any)?.projectPath;
    if (!projectPath) return "Errore: Percorso progetto non configurato.";

    try {
      const fullPath = path.join(projectPath, input.filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      const selection = lines.slice(input.startLine - 1, input.endLine);
      
      console.log(`[TOOL-USE] Lettura righe ${input.startLine}-${input.endLine} di ${input.filePath}`);
      
      return selection.join('\n');
    } catch (e: any) {
      return `Errore: ${e.message}`;
    }
  }
);

const readFileTool = ai.defineTool(
  {
    name: 'readFile',
    description: 'Legge il contenuto reale di un file. Se il file è > 500 righe, preferisci readFileLines.',
    inputSchema: z.object({
      filePath: z.string().describe('Percorso relativo del file.'),
    }),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    const projectPath = (context as any)?.projectPath;
    console.log(`\n[TOOL-USE] Lettura file completo: ${input.filePath}`);
    
    if (!projectPath) return "Errore: Percorso progetto mancante.";

    try {
      const fullPath = path.join(projectPath, input.filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      if (content.length > 20000) {
        return content.substring(0, 20000) + "\n\n...[CONTENUTO TRONCATO] Il file è troppo grande. Usa getFileInfo e readFileLines per analizzarlo meglio.";
      }
      return content;
    } catch (e: any) {
      return `Errore: ${e.message}`;
    }
  }
);

const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z.string(),
  history: z.array(MessageSchema).optional(),
  projectName: z.string().optional(),
  projectPath: z.string().optional(),
  model: z.string().optional(),
});

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  const rawModelName = input.model || 'qwen2.5-coder:7b';
  const selectedModel = `ollama/${rawModelName}`;
  
  console.log(`\n[AGENT-START] ---------------------------------------------------`);
  console.log(`[AGENT-START] Modello: ${selectedModel}`);
  console.log(`[AGENT-START] Task: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }
  
  const projectIndex = await loadProjectIndex(projectName);
  const projectSummary = projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n');

  try {
    const systemInstruction = `Sei un Ingegnere del Software Senior esperto in refactoring di grandi codebase.
      
      PROGETTO ATTUALE: ${projectName}
      MAPPA FILE DISPONIBILI:
      ${projectSummary}
      
      REGOLE PER FILE GRANDI (> 500 righe):
      1. Se l'utente ti chiede di analizzare o spezzettare un file enorme, USA 'getFileInfo' per capire quanto è lungo.
      2. Non cercare di leggere tutto il file in una volta. Leggilo a blocchi logici usando 'readFileLines' (es. 1-300, poi 301-600).
      3. Identifica i moduli logici (classi, funzioni export, costanti) e proponi un piano di separazione in nuovi file.
      4. Per ogni pezzo che estrai, scrivi il codice completo pronto per il nuovo file.

      FORMATO RISPOSTA:
      - Rispondi in Italiano.
      - Se generi un piano d'azione, usa questo formato speciale alla fine del messaggio: <PLAN>[{"step": "descrizione breve"}]</PLAN>.
      - Se vuoi usare un tool ma Genkit lo blocca, scrivi il JSON in una riga isolata: {"name": "readFileLines", "arguments": {"filePath": "...", "startLine": 1, "endLine": 300}}.`;

    let response = await ai.generate({
      model: selectedModel as any,
      history: input.history as any,
      system: systemInstruction,
      prompt: input.developmentTask,
      tools: [readFileTool, readFileLinesTool, getFileInfoTool],
      config: { context: { projectPath: input.projectPath } }
    });

    let text = response.text || "";
    
    // LOOP MANUALE DI RAGIONAMENTO (Se l'AI sputa JSON invece di chiamare il tool)
    const toolPatterns = [
      /\{"name":\s*"getFileInfo",\s*"arguments":\s*\{"filePath":\s*"([^"]+)"\}\}/,
      /\{"name":\s*"readFileLines",\s*"arguments":\s*\{"filePath":\s*"([^"]+)",\s*"startLine":\s*(\d+),\s*"endLine":\s*(\d+)\}\}/,
      /\{"name":\s*"readFile",\s*"arguments":\s*\{"filePath":\s*"([^"]+)"\}\}/
    ];

    let match = null;
    let toolResult = null;

    if (match = text.match(toolPatterns[0])) { // getFileInfo
      console.log(`[AGENT-MANUAL-LOOP] Eseguo getFileInfo per: ${match[1]}`);
      const info = await getFileInfoTool({ filePath: match[1] }, { context: { projectPath: input.projectPath } } as any);
      toolResult = JSON.stringify(info);
    } else if (match = text.match(toolPatterns[1])) { // readFileLines
      console.log(`[AGENT-MANUAL-LOOP] Eseguo readFileLines ${match[2]}-${match[3]} per: ${match[1]}`);
      toolResult = await readFileLinesTool({ filePath: match[1], startLine: parseInt(match[2]), endLine: parseInt(match[3]) }, { context: { projectPath: input.projectPath } } as any);
    } else if (match = text.match(toolPatterns[2])) { // readFile
      console.log(`[AGENT-MANUAL-LOOP] Eseguo readFile per: ${match[1]}`);
      toolResult = await readFileTool({ filePath: match[1] }, { context: { projectPath: input.projectPath } } as any);
    }

    if (toolResult) {
      const followUp = await ai.generate({
        model: selectedModel as any,
        history: [
          ...(input.history || []), 
          { role: 'user', content: input.developmentTask }, 
          { role: 'assistant', content: text }
        ] as any,
        system: systemInstruction,
        prompt: `RISULTATO TOOL:\n${toolResult}\n\nContinua l'analisi o il refactoring basandoti su questi dati. Ricordati di usare <PLAN> se hai dei passi futuri.`,
      });
      text = followUp.text || "";
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT-END] Operazione completata in ${duration}s.`);

    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      try { plan = JSON.parse(planMatch[1].trim()); } catch (e) { console.error("Plan parse error", e); }
    }

    return {
      content: text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim() || "Il modello ha avuto un'esitazione. Prova a essere più specifico nel range di righe.",
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT-ERROR]`, error.message);
    return { content: `Errore: ${error.message}. Assicurati che Ollama sia attivo.` };
  }
}
