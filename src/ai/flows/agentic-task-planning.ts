'use server';
/**
 * @fileOverview Flow per la generazione di piani d'azione basati sull'indice attivo.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { loadProjectIndex, listIndexedProjects } from './ai-codebase-indexing';

const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z.string(),
  projectName: z.string().optional(), // Permette di specificare quale progetto usare
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

Contesto Progetto (File e loro scopo):
{{{projectContext}}}

Richiesta Utente: {{{developmentTask}}}

Genera un piano d'azione dettagliato in JSON. Ogni passo deve fare riferimento ai file REALI presenti nel contesto sopra.
Sii specifico, non generico. Se l'utente chiede di una funzione specifica, indica quale file modificare.

Rispondi SOLO con il JSON del piano.`,
});

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  // Carica l'ultimo progetto usato o quello specificato
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }

  const projectIndex = await loadProjectIndex(projectName);
  const projectContext = projectIndex.length > 0 
    ? projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n')
    : "Nessun indice disponibile.";

  const { output } = await agenticTaskPlanningPrompt({
    developmentTask: input.developmentTask,
    projectContext: projectContext.substring(0, 15000),
  });

  return output || { plan: [{ step: "Nessun piano generato. Indicizza il progetto prima." }] };
}
