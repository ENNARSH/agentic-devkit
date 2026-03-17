'use server';
/**
 * @fileOverview Flow agentico che utilizza TOOLS per permettere all'AI di decidere quali file leggere.
 * Implementa un ciclo di ragionamento dove l'AI può richiedere l'accesso ai file fisici.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { loadProjectIndex, listIndexedProjects } from './ai-codebase-indexing';
import * as fs from 'fs/promises';
import * as path from 'path';

const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z.string(),
  projectName: z.string().optional(),
  projectPath: z.string().optional(),
  model: z.string().optional(), // Permette di specificare il modello da usare
});

/**
 * TOOL: Permette all'AI di leggere il contenuto reale di un file.
 */
const readFileTool = ai.defineTool(
  {
    name: 'readFile',
    description: 'Legge il contenuto di un file specifico dal file system del progetto. Usalo se la mappa del progetto non ti dà abbastanza dettagli o se devi analizzare la struttura UI.',
    inputSchema: z.object({
      filePath: z.string().describe('Il percorso relativo del file da leggere.'),
    }),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    const projectPath = (context as any)?.projectPath;
    if (!projectPath) {
      return "Errore: Percorso del progetto non configurato nella sessione. Chiedi all'utente di selezionare un progetto.";
    }

    try {
      const fullPath = path.join(projectPath, input.filePath);
      console.log(`[TOOL-USE] >>> L'agente sta analizzando: ${input.filePath}`);
      
      const content = await fs.readFile(fullPath, 'utf-8');
      
      const MAX_CHARS = 12000;
      if (content.length > MAX_CHARS) {
        return `[CONTENUTO TRONCATO - Dimensione: ${content.length}]\n\n${content.substring(0, MAX_CHARS)}\n\n... (file troppo grande)`;
      }
      
      return content;
    } catch (e: any) {
      return `Errore: Impossibile leggere ${input.filePath}.`;
    }
  }
);

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  // Se il modello non è specificato, usiamo quello di default di genkit.ts
  const selectedModel = input.model ? `ollama/${input.model}` : undefined;
  
  console.log(`\n[AGENT-REASONING] >>> Modello: ${input.model || 'Default'} | Task: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }
  
  const projectIndex = await loadProjectIndex(projectName);
  const projectSummary = projectIndex.length > 0 
    ? projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n')
    : "Indice non disponibile.";

  try {
    const response = await ai.generate({
      model: selectedModel as any, // Forza l'uso del modello selezionato
      system: `Sei un esperto Sviluppatore Full-Stack.
      
      MAPPA DEL PROGETTO:
      ${projectSummary}
      
      IL TUO COMPITO:
      1. Identifica i file rilevanti per la richiesta.
      2. USA 'readFile' per vedere il codice reale prima di suggerire modifiche.
      3. Proponi soluzioni concrete.
      
      REGOLE:
      - Sii tecnico e preciso.
      - Rispondi in Italiano.
      - Termina con un piano d'azione JSON tra tag <PLAN> e </PLAN>.`,
      prompt: input.developmentTask,
      tools: [readFileTool],
      config: { 
        context: { projectPath: input.projectPath } 
      }
    });

    const text = response.text;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT-RESPONSE] Completata in ${duration}s.`);

    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1].trim());
      } catch (e) {}
    }

    return {
      content: text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim(),
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT-ERR]`, error.message);
    return { 
      content: `Errore: ${error.message}. Assicurati che il modello '${input.model}' sia attivo su Ollama.`,
      plan: [{ step: "Verifica configurazione Ollama" }] 
    };
  }
}
