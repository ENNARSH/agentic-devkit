'use server';
/**
 * @fileOverview Flow agentico potenziato con log di debug per il monitoraggio dei Tools.
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
  model: z.string().optional(),
});

const readFileTool = ai.defineTool(
  {
    name: 'readFile',
    description: 'Legge il contenuto reale di un file sul disco. USALO SEMPRE se devi spiegare logica specifica o trovare bug in un file.',
    inputSchema: z.object({
      filePath: z.string().describe('Percorso relativo del file all\'interno del progetto.'),
    }),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    const projectPath = (context as any)?.projectPath;
    if (!projectPath) {
      console.warn(`[TOOL-ERROR] readFile fallito: Percorso progetto non trovato nel contesto.`);
      return "Errore: Percorso progetto mancante nel contesto dell'agente.";
    }

    try {
      const fullPath = path.join(projectPath, input.filePath);
      console.log(`[AGENT-ACTION] Chiamata tool 'readFile' per: ${input.filePath}`);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Troncamento intelligente per non saturare il contesto
      if (content.length > 15000) {
        console.log(`[AGENT-ACTION] File troppo grande (${content.length} chars). Invio primi 15k.`);
        return content.substring(0, 15000) + "\n\n...[CONTENUTO TRONCATO PER DIMENSIONI ECCESSIVE]...";
      }
      
      console.log(`[AGENT-ACTION] Lettura completata con successo (${content.length} chars).`);
      return content;
    } catch (e: any) {
      console.error(`[TOOL-ERROR] Errore critico in readFile: ${e.message}`);
      return `Errore durante la lettura del file: ${e.message}. Assicurati che il percorso sia corretto.`;
    }
  }
);

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  const selectedModel = input.model ? `ollama/${input.model}` : 'ollama/qwen2.5-coder:7b';
  
  console.log(`\n[AGENT-START] ---------------------------------------------------`);
  console.log(`[AGENT-START] Modello: ${selectedModel}`);
  console.log(`[AGENT-START] Task: "${input.developmentTask}"`);
  console.log(`[AGENT-START] Progetto: ${input.projectName || 'Default'}`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
    console.log(`[AGENT-INFO] Nessun progetto selezionato, uso: ${projectName}`);
  }
  
  const projectIndex = await loadProjectIndex(projectName);
  const projectSummary = projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n');
  console.log(`[AGENT-INFO] Indice caricato: ${projectIndex.length} file conosciuti.`);

  try {
    console.log(`[AGENT-REASONING] L'agente sta iniziando a pensare...`);
    const response = await ai.generate({
      model: selectedModel as any,
      system: `Sei un Ingegnere del Software Senior esperto in analisi del codice.
      
      CONTESTO DEL PROGETTO (Mappa dei file):
      ${projectSummary}
      
      REGOLE DI COMPORTAMENTO:
      1. Se l'utente chiede di un file specifico, USA il tool 'readFile' per leggerlo prima di rispondere. Non inventare il codice.
      2. Se devi spiegare una logica complessa, chiedi all'agente di leggere i file coinvolti.
      3. Rispondi sempre in Italiano.
      4. Se generi un piano d'azione, racchiudilo tra tag <PLAN>[{"step": "..."}]</PLAN>.`,
      prompt: input.developmentTask,
      tools: [readFileTool],
      config: { 
        context: { projectPath: input.projectPath }
      }
    });

    const text = response.text;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT-END] Risposta generata in ${duration}s.`);

    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      try { plan = JSON.parse(planMatch[1].trim()); } catch (e) {}
    }

    return {
      content: text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim(),
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT-ERROR] Errore durante la generazione:`, error.message);
    return { 
      content: `Mi dispiace, si è verificato un errore: ${error.message}. 
      Verifica che Ollama sia attivo e che il modello '${selectedModel}' sia stato scaricato correttamente.`,
      plan: [{ step: "Verifica stato Ollama" }] 
    };
  }
}
