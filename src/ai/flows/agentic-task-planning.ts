'use server';
/**
 * @fileOverview Flow per la generazione di piani d'azione basati sull'indice attivo.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { loadProjectIndex, listIndexedProjects } from './ai-codebase-indexing';

const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z.string(),
  projectName: z.string().optional(),
});

const AgenticTaskPlanningOutputSchema = z.object({
  content: z.string(),
  plan: z.array(z.object({
    step: z.string(),
    tool: z.string().optional(),
    toolInput: z.any().optional(),
  })).optional(),
});

const agenticTaskPlanningPrompt = ai.definePrompt({
  name: 'agenticTaskPlanningPrompt',
  input: { 
    schema: z.object({
      developmentTask: z.string(),
      projectContext: z.string(),
    }) 
  },
  output: { format: 'text' },
  prompt: `Sei un architetto software esperto. Hai accesso alla struttura del progetto tramite il Contesto Progetto.

Contesto Progetto (File reali del progetto dell'utente):
{{{projectContext}}}

Richiesta Utente: {{{developmentTask}}}

ISTRUZIONI:
1. Analizza la richiesta dell'utente basandoti sui file reali elencati sopra.
2. Fornisci una spiegazione testuale di cosa bisogna fare.
3. Se appropriato, includi un piano d'azione in formato JSON alla fine della tua risposta, racchiuso tra tag <PLAN> e </PLAN>.
4. Il JSON deve essere un array di oggetti con la chiave "step". Esempio: <PLAN>[{"step": "Modifica file X"}, {"step": "Aggiorna rotta Y"}]</PLAN>

Rispondi in modo professionale e specifico.`,
});

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  console.log(`[AGENT] Richiesta: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }

  const projectIndex = await loadProjectIndex(projectName);
  
  const projectContext = projectIndex.length > 0
    ? projectIndex.slice(0, 150).map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n')
    : "Nessun indice disponibile. L'utente deve ancora indicizzare il progetto.";

  try {
    const { text } = await agenticTaskPlanningPrompt({
      developmentTask: input.developmentTask,
      projectContext,
    });

    if (!text) throw new Error("L'AI non ha risposto.");

    // Estrazione del piano JSON se presente
    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1].trim());
      } catch (e) {
        console.warn("[AGENT] Errore parsing piano JSON, uso testo semplice.");
      }
    }

    // Se non c'è un piano formale ma c'è testo, restituiamo il testo come contenuto principale
    return {
      content: text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim(),
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error) {
    console.error(`[AGENT] ERRORE:`, error);
    return { 
      content: "Si è verificato un errore durante l'elaborazione. Assicurati che Ollama sia attivo.",
      plan: [{ step: "Errore di connessione o timeout." }] 
    };
  }
}
