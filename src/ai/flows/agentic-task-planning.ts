
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

const agenticTaskPlanningPrompt = ai.definePrompt({
  name: 'agenticTaskPlanningPrompt',
  input: { 
    schema: z.object({
      developmentTask: z.string(),
      projectContext: z.string(),
    }) 
  },
  output: { format: 'text' },
  prompt: `Sei un architetto software esperto. Hai accesso alla struttura del progetto tramite il Contesto Progetto fornito.

Contesto Progetto (File reali del progetto dell'utente con i loro scopi):
{{{projectContext}}}

Richiesta Utente: {{{developmentTask}}}

ISTRUZIONI:
1. Analizza la richiesta dell'utente basandoti sui file reali elencati sopra.
2. Fornisci una spiegazione testuale chiara di cosa fa il codice o di come risolvere il problema.
3. Se appropriato (es. per modifiche o nuovi task), includi un piano d'azione in formato JSON alla fine della tua risposta, racchiuso ESCLUSIVAMENTE tra tag <PLAN> e </PLAN>.
4. Il JSON nel piano deve essere un array di oggetti con la chiave "step". Esempio: <PLAN>[{"step": "Modifica file X"}, {"step": "Aggiorna rotta Y"}]</PLAN>

Rispondi in modo professionale, tecnico e specifico. Se ti viene chiesto cosa fa un file, cercalo nell'elenco sopra e descrivilo.`,
});

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  console.log(`\n[AGENT] >>> Nuova richiesta ricevuta: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    console.log(`[AGENT] Nessun progetto specificato, cerco nell'elenco...`);
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }
  
  console.log(`[AGENT] Caricamento indice per: ${projectName}...`);
  const projectIndex = await loadProjectIndex(projectName);
  console.log(`[AGENT] Indice caricato: ${projectIndex.length} file trovati.`);
  
  // Prepariamo il contesto limitando per non sovraccaricare il modello locale
  const contextLimit = 100; 
  const projectContext = projectIndex.length > 0
    ? projectIndex.slice(0, contextLimit).map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n')
    : "Nessun indice disponibile. L'utente deve ancora indicizzare il progetto.";

  console.log(`[AGENT] Contesto preparato (${projectContext.length} caratteri). Invio richiesta a Ollama...`);

  try {
    const { text } = await agenticTaskPlanningPrompt({
      developmentTask: input.developmentTask,
      projectContext,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT] Risposta ricevuta da Ollama in ${duration}s.`);

    if (!text) {
      console.error(`[AGENT] Ollama ha restituito una risposta vuota.`);
      throw new Error("L'AI non ha risposto.");
    }

    console.log(`[AGENT] Analisi risposta (primi 100 char): "${text.substring(0, 100).replace(/\n/g, ' ')}..."`);

    // Estrazione del piano JSON se presente tramite tag <PLAN>
    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      console.log(`[AGENT] Trovato blocco <PLAN>, inizio parsing JSON...`);
      try {
        const jsonContent = planMatch[1].trim();
        plan = JSON.parse(jsonContent);
        console.log(`[AGENT] Piano d'azione estratto con successo (${plan.length} step).`);
      } catch (e) {
        console.warn("[AGENT] Errore nel parsing del JSON nel blocco <PLAN>. Uso solo testo.");
      }
    } else {
      console.log(`[AGENT] Nessun blocco <PLAN> trovato nella risposta.`);
    }

    const cleanContent = text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim();
    console.log(`[AGENT] <<< Elaborazione completata.\n`);

    return {
      content: cleanContent,
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[AGENT] !!! ERRORE dopo ${duration}s:`, error.message);
    
    let userFriendlyError = "Si è verificato un errore durante l'elaborazione.";
    if (error.message.includes('memory')) {
      userFriendlyError = "Errore di memoria: Il modello AI è troppo grande per il tuo PC. Prova a chiudere altre applicazioni o usa un modello più leggero come 'llama3.2:3b'.";
    } else if (error.message.includes('fetch')) {
      userFriendlyError = "Errore di connessione: Assicurati che Ollama sia attivo su http://localhost:11434.";
    }

    return { 
      content: userFriendlyError,
      plan: [{ step: "Verifica stato di Ollama o cambia modello in src/ai/genkit.ts" }] 
    };
  }
}
