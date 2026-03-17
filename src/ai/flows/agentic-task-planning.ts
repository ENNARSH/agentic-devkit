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
});

/**
 * TOOL: Permette all'AI di leggere il contenuto reale di un file.
 * Se il file è troppo grande, viene troncato per evitare di superare il contesto del modello.
 */
const readFileTool = ai.defineTool(
  {
    name: 'readFile',
    description: 'Legge il contenuto di un file specifico dal file system del progetto. Usalo se la mappa del progetto non ti dà abbastanza dettagli.',
    inputSchema: z.object({
      filePath: z.string().describe('Il percorso relativo del file da leggere.'),
    }),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    const projectPath = (context as any)?.projectPath;
    if (!projectPath) {
      return "Errore: Percorso del progetto non configurato nella sessione.";
    }

    try {
      const fullPath = path.join(projectPath, input.filePath);
      console.log(`[TOOL-USE] >>> L'agente ha richiesto la lettura di: ${input.filePath}`);
      
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      const MAX_CHARS = 10000;
      if (content.length > MAX_CHARS) {
        console.log(`[TOOL-INFO] File troppo grande (${content.length} caratteri). Invio solo i primi ${MAX_CHARS}.`);
        return `[CONTENUTO TRONCATO - Dimensione totale: ${content.length} caratteri]\n\n${content.substring(0, MAX_CHARS)}\n\n... (il file continua, chiedi specifiche parti se necessario)`;
      }
      
      return content;
    } catch (e: any) {
      console.error(`[TOOL-ERR] Errore lettura file ${input.filePath}:`, e.message);
      return `Errore: Impossibile accedere a ${input.filePath}. Verifica che il file esista nel percorso specificato.`;
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
  
  console.log(`[AGENT] Caricamento indice: ${projectName}...`);
  const projectIndex = await loadProjectIndex(projectName);
  
  const projectSummary = projectIndex.length > 0 
    ? projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n')
    : "Mappa del progetto non disponibile.";

  try {
    /**
     * ESECUZIONE AGENTICA:
     * L'AI ha la mappa come contesto di base e readFileTool come strumento di esplorazione.
     * Genkit gestisce automaticamente il loop di chiamate ai tool.
     */
    const response = await ai.generate({
      model: 'ollama/qwen2.5-coder:7b',
      system: `Sei un Ingegnere del Software Esperto. Hai accesso a una mappa semantica del progetto e allo strumento 'readFile'.
      
      MAPPA DEL PROGETTO (Utilizzala per orientarti e trovare i file giusti):
      ${projectSummary}
      
      REGOLE DI RAGIONAMENTO:
      1. Se l'utente chiede spiegazioni su un file, NON basarti solo sulla mappa. USA 'readFile' per vedere il codice reale.
      2. Se un file è troppo grande, ti verranno inviati i primi 10.000 caratteri.
      3. Fornisci risposte tecniche, precise e basate sull'evidenza del codice.
      4. Concludi SEMPRE con un piano d'azione JSON racchiuso tra tag <PLAN> e </PLAN>.
      
      Esempio Piano:
      <PLAN>
      [
        {"step": "Modifica la funzione update() in app.php per includere il log"},
        {"step": "Verifica che il database venga aggiornato correttamente"}
      ]
      </PLAN>`,
      prompt: input.developmentTask,
      tools: [readFileTool],
      config: { 
        context: { projectPath: input.projectPath } 
      }
    });

    const text = response.text;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT-RESPONSE] Elaborata in ${duration}s.`);

    // Estrazione del piano d'azione
    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1].trim());
      } catch (e) {
        console.warn("[AGENT] Piano d'azione generato in formato non valido.");
      }
    }

    // Rimuoviamo il tag PLAN dal testo visualizzato per pulizia
    const cleanContent = text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim();
    
    return {
      content: cleanContent,
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT-CRITICAL]`, error.message);
    return { 
      content: `L'agente ha riscontrato un errore: ${error.message}. Verifica le risorse di sistema o il modello Ollama.`,
      plan: [{ step: "Verifica lo stato del modello locale o riprova con una richiesta più semplice" }] 
    };
  }
}
