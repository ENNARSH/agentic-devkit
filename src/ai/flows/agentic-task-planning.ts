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
  projectPath: z.string().optional(),
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
  prompt: `Sei un Architetto Software Senior. Il tuo compito è analizzare la richiesta dell'utente e fornire una spiegazione tecnica seguita da un piano d'azione.

Hai accesso alla mappa del progetto (RAG) e, se pertinente, al contenuto reale di un file.

---
MAPPA DEL PROGETTO (File indicizzati):
{{{projectContext}}}

{{#if fileContent}}
CONTENUTO DEL FILE ANALIZZATO:
{{{fileContent}}}
{{/if}}
---

RICHIESTA UTENTE: {{{developmentTask}}}

ISTRUZIONI:
1. Spiega brevemente come il progetto gestisce questa richiesta basandoti sui file della mappa.
2. Se il contenuto di un file è fornito, analizzalo per dare suggerimenti precisi.
3. Concludi SEMPRE con un piano d'azione tra tag <PLAN> e </PLAN>.
4. Il piano deve essere un array JSON: [{"step": "Azione tecnica da compiere"}].

Rispondi in modo professionale.`,
});

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  console.log(`\n[AGENT] >>> Nuova richiesta: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }
  
  console.log(`[AGENT] Caricamento indice: ${projectName}...`);
  const projectIndex = await loadProjectIndex(projectName);
  
  if (projectIndex.length === 0) {
    console.warn("[AGENT] Attenzione: l'indice caricato è vuoto.");
  }

  // Logica di Retrieval (RAG): cerchiamo se l'utente parla di un file specifico
  let specificFileContent = "";
  const mentionedFile = projectIndex.find(f => 
    input.developmentTask.toLowerCase().includes(path.basename(f.filePath).toLowerCase())
  );

  if (mentionedFile && input.projectPath) {
    try {
      const fullPath = path.join(input.projectPath, mentionedFile.filePath);
      console.log(`[AGENT] Lettura file fisico per analisi profonda: ${fullPath}`);
      const content = await fs.readFile(fullPath, 'utf-8');
      specificFileContent = content.substring(0, 8000); // Limite per non saturare la RAM dell'AI
    } catch (e) {
      console.error(`[AGENT] Errore lettura file fisico:`, e);
    }
  }

  // Limitiamo il contesto della mappa per Ollama
  const projectContext = projectIndex.slice(0, 100).map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n');

  console.log(`[AGENT] Interrogazione modello AI in corso...`);

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
        console.warn("[AGENT] Il modello ha generato un piano JSON non valido.");
      }
    }

    const cleanContent = text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim();
    return {
      content: cleanContent,
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT] ERRORE CRITICO:`, error.message);
    return { 
      content: "Il modello AI è andato in timeout o ha esaurito la memoria. Prova a usare un modello più piccolo (es. llama3.2:3b) o a fare domande su singoli file.",
      plan: [{ step: "Verifica risorse di sistema" }, { step: "Riavvia Ollama" }] 
    };
  }
}
