'use server';
/**
 * @fileOverview Flow agentico ottimizzato per file di grandi dimensioni, refactoring e creazione progetti.
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
      console.log(`[TOOL-USE] getFileInfo per ${input.filePath}: ${lines.length} righe.`);
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
    if (!projectPath) return "Errore: Percorso progetto mancante.";

    try {
      const fullPath = path.join(projectPath, input.filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      console.log(`[TOOL-USE] Lettura file completo: ${input.filePath} (${content.length} caratteri).`);

      if (content.length > 20000) {
        return content.substring(0, 20000) + "\n\n...[CONTENUTO TRONCATO] Il file è troppo grande. Usa getFileInfo e readFileLines per analizzarlo meglio.";
      }
      return content;
    } catch (e: any) {
      return `Errore: ${e.message}`;
    }
  }
);

const writeFileTool = ai.defineTool(
  {
    name: 'writeFile',
    description: 'Scrive o sovrascrive un file con il nuovo contenuto. Usalo per applicare modifiche, creare nuovi file o generare interi progetti.',
    inputSchema: z.object({
      filePath: z.string().describe('Percorso relativo del file.'),
      content: z.string().describe('Il contenuto integrale del file.'),
    }),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    const projectPath = (context as any)?.projectPath;
    if (!projectPath) return "Errore: Percorso progetto mancante.";

    try {
      const fullPath = path.join(projectPath, input.filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, input.content, 'utf-8');
      console.log(`[TOOL-USE] File scritto con successo: ${input.filePath}`);
      return `Successo: File ${input.filePath} aggiornato/creato.`;
    } catch (e: any) {
      return `Errore scrittura: ${e.message}`;
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
    projectName = projects.length > 0 ? projects[0].name : 'new-project';
  }
  
  const projectIndex = await loadProjectIndex(projectName);
  const projectSummary = projectIndex.length > 0 
    ? projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n')
    : "Il progetto è vuoto o nuovo. Sei libero di creare la struttura iniziale.";

  try {
    const systemInstruction = `Sei un Ingegnere del Software Senior esperto in refactoring e architettura software.
      
      STATO PROGETTO: ${projectName}
      MAPPA FILE:
      ${projectSummary}
      
      PROTOCOLLO AGENTICO (OBBLIGATORIO):
      1. Se devi analizzare o modificare file, USA SEMPRE i tools. Non fare supposizioni.
      2. FILE GRANDI (> 500 righe): Usa sempre 'getFileInfo' prima di leggere, poi 'readFileLines' per piccoli blocchi.
      3. PIANO D'AZIONE: Prima di scrivere codice, genera sempre un piano strutturato usando il formato <PLAN>[{"step": "descrizione"}]</PLAN>.
      4. CREAZIONE: Se l'utente vuole iniziare un nuovo progetto, crea prima un piano per i file fondamentali (config, package.json, src/index, ecc.).
      5. SCRITTURA: Usa 'writeFile' per creare o aggiornare file. Fornisci sempre il contenuto integrale.

      FORMATO RISPOSTA:
      - Rispondi in Italiano.
      - Sii estremamente tecnico e conciso.
      - Se Genkit blocca i tools, scrivi il comando JSON isolato: {"name": "writeFile", "arguments": {"filePath": "...", "content": "..."}}.`;

    console.log(`[AGENT-REASONING] Elaborazione con ${input.history?.length || 0} messaggi di memoria...`);

    let response = await ai.generate({
      model: selectedModel as any,
      history: input.history as any,
      system: systemInstruction,
      prompt: input.developmentTask,
      tools: [readFileTool, readFileLinesTool, getFileInfoTool, writeFileTool],
      config: { context: { projectPath: input.projectPath } }
    });

    let text = response.text || "";
    console.log(`[AGENT-RESPONSE] Caratteri ricevuti: ${text.length}`);
    
    // LOOP MANUALE DI RAGIONAMENTO (Se l'AI sputa JSON invece di chiamare il tool)
    const toolPatterns = [
      /\{"name":\s*"getFileInfo",\s*"arguments":\s*\{"filePath":\s*"([^"]+)"\}\}/,
      /\{"name":\s*"readFileLines",\s*"arguments":\s*\{"filePath":\s*"([^"]+)",\s*"startLine":\s*(\d+),\s*"endLine":\s*(\d+)\}\}/,
      /\{"name":\s*"readFile",\s*"arguments":\s*\{"filePath":\s*"([^"]+)"\}\}/,
      /\{"name":\s*"writeFile",\s*"arguments":\s*\{"filePath":\s*"([^"]+)",\s*"content":\s*"([\s\S]+)"\}\}/
    ];

    let toolResult = null;
    let match = null;

    if (match = text.match(toolPatterns[0])) { 
      toolResult = JSON.stringify(await getFileInfoTool({ filePath: match[1] }, { context: { projectPath: input.projectPath } } as any));
    } else if (match = text.match(toolPatterns[1])) {
      toolResult = await readFileLinesTool({ filePath: match[1], startLine: parseInt(match[2]), endLine: parseInt(match[3]) }, { context: { projectPath: input.projectPath } } as any);
    } else if (match = text.match(toolPatterns[2])) {
      toolResult = await readFileTool({ filePath: match[1] }, { context: { projectPath: input.projectPath } } as any);
    } else if (match = text.match(toolPatterns[3])) {
      console.log(`[AGENT-MANUAL-LOOP] Rilevata tool call 'writeFile' per: ${match[1]}`);
      toolResult = await writeFileTool({ filePath: match[1], content: match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"') }, { context: { projectPath: input.projectPath } } as any);
    }

    if (toolResult) {
      console.log(`[AGENT-MANUAL-LOOP] Eseguito tool manualmente. Reinoltro all'AI per feedback...`);
      const followUp = await ai.generate({
        model: selectedModel as any,
        history: [
          ...(input.history || []), 
          { role: 'user', content: input.developmentTask }, 
          { role: 'assistant', content: text }
        ] as any,
        system: systemInstruction,
        prompt: `RISULTATO TOOL:\n${toolResult}\n\nAnalizza il risultato e rispondi all'utente o procedi con il prossimo passo del piano.`,
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
      content: text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim() || "L'agente ha terminato l'azione senza testo aggiuntivo.",
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT-ERROR]`, error.message);
    throw error;
  }
}
