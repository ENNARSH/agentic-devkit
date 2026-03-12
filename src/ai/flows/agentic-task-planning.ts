'use server';
/**
 * @fileOverview Flow per la generazione di piani d'azione basati sull'indice attivo.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { loadProjectIndex, listIndexedProjects } from './ai-codebase-indexing';

const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z.string(),
  projectName: z.string().optional(), // Nome del progetto/file index da usare
});

const AgenticTaskPlanningOutputSchema = z.object({
  plan: z.array(z.object({
    step: z.string(),
    tool: z.string().optional(),
    toolInput: z.any().optional(),
  })),
});

const agenticTaskPlanningPrompt = ai.definePrompt({
  name: 'agenticTaskPlanningPrompt',
  input: { 
    schema: z.object({
      developmentTask: z.string(),
      projectContext: z.string(),
    }) 
  },
  output: { schema: AgenticTaskPlanningOutputSchema },
  prompt: `Sei un architetto software esperto. Hai accesso alla struttura del progetto tramite il Contesto Progetto qui sotto.

IMPORTANTE: Il contesto contiene l'elenco dei file REALI del progetto dell'utente. Usa queste informazioni per essere specifico.
Se l'utente chiede quali sono i file principali, elenca quelli più rilevanti trovati nel contesto (es. controller, modelli, rotte).

Contesto Progetto (File e loro scopo):
{{{projectContext}}}

Richiesta Utente: {{{developmentTask}}}

Genera un piano d'azione dettagliato in JSON. Ogni passo deve fare riferimento ai file REALI presenti nel contesto sopra.
Rispondi SOLO con il JSON del piano conforme allo schema richiesto.`,
});

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  console.log(`[AGENT] Ricevuta richiesta: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  
  // Se non specificato, cerchiamo il primo progetto disponibile
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
    console.log(`[AGENT] Nessun progetto specificato, uso il default: ${projectName}`);
  }

  console.log(`[AGENT] Caricamento indice per progetto: ${projectName}...`);
  const projectIndex = await loadProjectIndex(projectName);
  
  if (projectIndex.length === 0) {
    console.warn(`[AGENT] ATTENZIONE: L'indice per "${projectName}" è vuoto o mancante.`);
    return { plan: [{ step: "Errore: Indice non trovato o vuoto. Assicurati di aver indicizzato il progetto." }] };
  }

  console.log(`[AGENT] Indice caricato con successo (${projectIndex.length} file). Generazione contesto...`);
  
  // Costruiamo il contesto limitando i token (prendiamo i primi 200 file per sicurezza)
  const projectContext = projectIndex
    .slice(0, 200)
    .map(f => `- ${f.filePath}: ${f.semanticSummary}`)
    .join('\n');

  try {
    console.log(`[AGENT] Inviando prompt a Ollama...`);
    const { output } = await agenticTaskPlanningPrompt({
      developmentTask: input.developmentTask,
      projectContext,
    });
    
    console.log(`[AGENT] Risposta ricevuta da Ollama.`);
    return output || { plan: [{ step: "L'AI non ha generato un piano valido." }] };
  } catch (error) {
    console.error(`[AGENT] ERRORE durante la generazione del piano:`, error);
    throw error;
  }
}
