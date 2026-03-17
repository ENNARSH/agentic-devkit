'use server';
/**
 * @fileOverview Flow agentico che utilizza TOOLS per permettere all'AI di decidere quali file leggere.
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
});

/**
 * TOOL: Permette all'AI di leggere il contenuto reale di un file.
 */
const readFileTool = ai.defineTool(
  {
    name: 'readFile',
    description: 'Legge il contenuto di un file specifico dal file system del progetto.',
    inputSchema: z.object({
      filePath: z.string().describe('Il percorso relativo del file da leggere.'),
    }),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    // Recuperiamo il projectPath dal contesto della sessione (passato nel flow)
    const projectPath = (context as any)?.projectPath;
    if (!projectPath) {
      return "Errore: Percorso del progetto non configurato.";
    }

    try {
      const fullPath = path.join(projectPath, input.filePath);
      console.log(`[TOOL-USE] L'agente sta leggendo il file: ${fullPath}`);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Ritorniamo i primi 8000 caratteri per non saturare la memoria dell'LLM
      return content.length > 8000 
        ? content.substring(0, 8000) + "\n\n[...File troncato per dimensioni...]" 
        : content;
    } catch (e: any) {
      console.error(`[TOOL-ERR] Impossibile leggere ${input.filePath}:`, e.message);
      return `Errore: Impossibile leggere il file ${input.filePath}. Assicurati che il percorso sia corretto.`;
    }
  }
);

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  console.log(`\n[AGENT-REASONING] >>> Analisi richiesta: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }
  
  console.log(`[AGENT] Caricamento mappa mentale del progetto: ${projectName}...`);
  const projectIndex = await loadProjectIndex(projectName);
  
  // Creiamo un sommario della mappa per dare all'AI una visione d'insieme
  const projectSummary = projectIndex.length > 0 
    ? projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n')
    : "Nessun indice trovato per questo progetto.";

  try {
    /**
     * ESECUZIONE AGENTICA:
     * L'AI ha a disposizione la mappa (projectSummary) e lo strumento (readFileTool).
     * Se la mappa non basta, userà 'readFile' per analizzare il codice reale.
     */
    const response = await ai.generate({
      model: 'ollama/qwen2.5-coder:7b',
      system: `Sei un Architetto Software Senior. Hai accesso a una mappa del progetto e allo strumento 'readFile'.
      
      MAPPA DEL PROGETTO (Usa questa per capire quali file esistono):
      ${projectSummary}
      
      ISTRUZIONI:
      1. Se la richiesta riguarda il funzionamento di un codice specifico, USA 'readFile' per vedere il file reale prima di rispondere.
      2. Non inventare il codice. Leggi i file se non sei sicuro.
      3. Fornisci una spiegazione tecnica chiara.
      4. Includi SEMPRE un piano d'azione JSON racchiuso tra tag <PLAN> e </PLAN> alla fine della tua risposta.
      5. Esempio piano: <PLAN>[{"step": "Modifica la funzione X in file.php"}]</PLAN>`,
      prompt: input.developmentTask,
      tools: [readFileTool],
      // Passiamo il path fisico nei metadati del contesto per il tool
      config: { 
        context: { projectPath: input.projectPath } 
      }
    });

    const text = response.text;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT-RESPONSE] Elaborata in ${duration}s.`);

    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1].trim());
      } catch (e) {
        console.warn("[AGENT] L'AI ha generato un piano JSON non valido.");
      }
    }

    // Puliamo il testo rimuovendo i tag del piano per visualizzarlo meglio nella chat
    const cleanContent = text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim();
    
    return {
      content: cleanContent,
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT-CRITICAL]`, error.message);
    return { 
      content: `L'agente ha riscontrato un problema: ${error.message}. Verifica che Ollama sia in esecuzione con il modello corretto.`,
      plan: [{ step: "Verifica le risorse di sistema o semplifica la richiesta" }] 
    };
  }
}
