'use server';
/**
 * @fileOverview Flow agentico potenziato con supporto esplicito ai tools.
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
    description: 'Legge il contenuto reale di un file. USALO SEMPRE se devi analizzare bug o spiegare logica specifica.',
    inputSchema: z.object({
      filePath: z.string().describe('Percorso relativo del file.'),
    }),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    const projectPath = (context as any)?.projectPath;
    if (!projectPath) return "Errore: Percorso progetto mancante.";

    try {
      const fullPath = path.join(projectPath, input.filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      console.log(`[AGENT-ACTION] Lettura file: ${input.filePath}`);
      return content.length > 12000 ? content.substring(0, 12000) + "\n...[TRUNCATED]" : content;
    } catch (e: any) {
      return `Errore lettura: ${e.message}`;
    }
  }
);

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  const selectedModel = input.model ? `ollama/${input.model}` : 'ollama/qwen2.5-coder:7b';
  
  console.log(`\n[AGENT-START] Modello: ${selectedModel} | Task: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }
  
  const projectIndex = await loadProjectIndex(projectName);
  const projectSummary = projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n');

  try {
    const response = await ai.generate({
      model: selectedModel as any,
      system: `Sei un Ingegnere del Software esperto.
      
      CONTESTO PROGETTO:
      ${projectSummary}
      
      ISTRUZIONI:
      1. Se l'utente chiede informazioni su file specifici, USA il tool 'readFile'.
      2. Non inventare il codice: leggilo prima di rispondere.
      3. Rispondi in Italiano.
      4. Includi un piano d'azione JSON finale tra tag <PLAN>...</PLAN>.`,
      prompt: input.developmentTask,
      tools: [readFileTool],
      config: { 
        context: { projectPath: input.projectPath }
      }
    });

    const text = response.text;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT-END] Completato in ${duration}s.`);

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
    console.error(`[AGENT-ERROR]`, error.message);
    return { 
      content: `Errore: ${error.message}. Il modello potrebbe non supportare i tools o essere troppo pesante.`,
      plan: [{ step: "Verifica configurazione Ollama" }] 
    };
  }
}
