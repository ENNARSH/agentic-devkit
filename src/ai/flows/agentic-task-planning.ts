
'use server';
/**
 * @fileOverview Flow per la generazione di piani d'azione basati sull'indice attivo e lettura reale dei file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { loadProjectIndex, listIndexedProjects } from './ai-codebase-indexing';
import * as fs from 'fs/promises';
import * as path from 'path';

const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z.string(),
  projectName: z.string().optional(),
  projectPath: z.string().optional(), // Il path fisico per leggere i file
});

const agenticTaskPlanningPrompt = ai.definePrompt({
  name: 'agenticTaskPlanningPrompt',
  input: { 
    schema: z.object({
      developmentTask: z.string(),
      projectContext: z.string(),
      fileContent: z.string().optional(),
    }) 
  },
  output: { format: 'text' },
  prompt: `Sei un architetto software esperto e un assistente alla programmazione.

Hai accesso alla struttura del progetto tramite il "Contesto Progetto" (riassunti dei file).
Se l'utente chiede di un file specifico e il suo contenuto è fornito in "Contenuto File Reale", analizzalo profondamente per suggerire modifiche esatte.

---
CONTESTO PROGETTO (Mappa dei file):
{{{projectContext}}}

{{#if fileContent}}
CONTENUTO FILE REALE (Usa questo per analisi precise):
{{{fileContent}}}
{{/if}}
---

RICHIESTA UTENTE: {{{developmentTask}}}

ISTRUZIONI:
1. Analizza la richiesta basandoti sui file reali.
2. Se devi suggerire modifiche, sii specifico su quali righe o funzioni cambiare.
3. Includi SEMPRE un piano d'azione strutturato alla fine della tua risposta, racchiuso ESCLUSIVAMENTE tra tag <PLAN> e </PLAN>.
4. Il JSON nel piano deve essere un array di oggetti: [{"step": "Descrizione tecnica del passaggio"}].

Rispondi in modo professionale e tecnico.`,
});

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  console.log(`\n[AGENT] >>> Richiesta: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }
  
  console.log(`[AGENT] Caricamento indice: ${projectName}...`);
  const projectIndex = await loadProjectIndex(projectName);
  
  // Cerchiamo se l'utente ha menzionato un file specifico nell'indice
  let specificFileContent = "";
  const mentionedFile = projectIndex.find(f => 
    input.developmentTask.toLowerCase().includes(f.filePath.toLowerCase()) ||
    input.developmentTask.toLowerCase().includes(path.basename(f.filePath).toLowerCase())
  );

  if (mentionedFile && input.projectPath) {
    try {
      console.log(`[AGENT] Rilevato file specifico: ${mentionedFile.filePath}. Lettura contenuto reale...`);
      const fullPath = path.join(input.projectPath, mentionedFile.filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      specificFileContent = content.substring(0, 10000); // Limite per il contesto AI
    } catch (e) {
      console.warn(`[AGENT] Impossibile leggere il file fisico: ${mentionedFile.filePath}`);
    }
  }

  const projectContext = projectIndex.slice(0, 150).map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n');

  console.log(`[AGENT] Invio a Ollama...`);

  try {
    const { text } = await agenticTaskPlanningPrompt({
      developmentTask: input.developmentTask,
      projectContext,
      fileContent: specificFileContent || undefined,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT] Risposta ricevuta in ${duration}s.`);

    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1].trim());
      } catch (e) {
        console.warn("[AGENT] Errore parsing JSON del piano.");
      }
    }

    const cleanContent = text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim();
    return {
      content: cleanContent,
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT] ERRORE:`, error.message);
    return { 
      content: "Si è verificato un errore di memoria o di connessione con Ollama. Verifica la RAM libera o usa un modello più piccolo.",
      plan: [{ step: "Verifica stato di Ollama (ollama list)" }] 
    };
  }
}
