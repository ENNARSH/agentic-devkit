'use server';
/**
 * @fileOverview Flow agentico con supporto per la cronologia (memoria) e log di debug avanzati.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { loadProjectIndex, listIndexedProjects } from './ai-codebase-indexing';
import * as fs from 'fs/promises';
import * as path from 'path';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

const AgenticTaskPlanningInputSchema = z.object({
  developmentTask: z.string(),
  history: z.array(MessageSchema).optional(),
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
    console.log(`\n[TOOL-USE] L'agente sta chiamando 'readFile' per: ${input.filePath}`);
    
    if (!projectPath) {
      console.error(`[TOOL-ERROR] Percorso progetto mancante nel contesto.`);
      return "Errore: Percorso progetto non configurato.";
    }

    try {
      const fullPath = path.join(projectPath, input.filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      console.log(`[TOOL-SUCCESS] Letto file ${input.filePath} (${content.length} caratteri).`);
      
      if (content.length > 15000) {
        return content.substring(0, 15000) + "\n\n...[CONTENUTO TRONCATO PER DIMENSIONI ECCESSIVE]...";
      }
      return content;
    } catch (e: any) {
      console.error(`[TOOL-ERROR] Errore lettura file: ${e.message}`);
      return `Errore durante la lettura del file: ${e.message}. Assicurati che il percorso sia corretto.`;
    }
  }
);

export async function agenticTaskPlanning(input: z.infer<typeof AgenticTaskPlanningInputSchema>) {
  const startTime = Date.now();
  const rawModelName = input.model || 'qwen2.5-coder:7b';
  const selectedModel = `ollama/${rawModelName}`;
  
  console.log(`\n[AGENT-START] ---------------------------------------------------`);
  console.log(`[AGENT-START] Modello: ${selectedModel}`);
  console.log(`[AGENT-START] Task: "${input.developmentTask}"`);
  
  let projectName = input.projectName;
  if (!projectName) {
    const projects = await listIndexedProjects();
    projectName = projects.length > 0 ? projects[0].name : 'project-index';
  }
  
  const projectIndex = await loadProjectIndex(projectName);
  const projectSummary = projectIndex.map(f => `- ${f.filePath}: ${f.semanticSummary}`).join('\n');

  try {
    console.log(`[AGENT-REASONING] L'agente sta elaborando con ${input.history?.length || 0} messaggi di memoria...`);
    
    let response = await ai.generate({
      model: selectedModel as any,
      history: input.history as any,
      system: `Sei un Ingegnere del Software Senior esperto in analisi del codice.
      
      CONTESTO DEL PROGETTO (Mappa dei file):
      ${projectSummary}
      
      REGOLE DI COMPORTAMENTO:
      1. Se l'utente chiede di un file specifico, USA il tool 'readFile' per leggerlo prima di rispondere.
      2. Se non sei sicuro, USA 'readFile' per verificare la realtà dei fatti sul disco.
      3. Rispondi sempre in Italiano.
      4. Se generi un piano d'azione, racchiudilo tra tag <PLAN>[{"step": "..."}]</PLAN>.`,
      prompt: input.developmentTask,
      tools: [readFileTool],
      config: { 
        context: { projectPath: input.projectPath }
      }
    });

    let text = response.text || "";
    
    // --- MANUALE TOOL DETECTION (Se il modello sputa JSON invece di chiamare il tool) ---
    const toolCallMatch = text.match(/\{"name":\s*"readFile",\s*"arguments":\s*\{"filePath":\s*"([^"]+)"\}\}/);
    if (toolCallMatch) {
      const filePath = toolCallMatch[1];
      console.log(`[AGENT-MANUAL-LOOP] Rilevata tool call nel testo per: ${filePath}. Esecuzione manuale...`);
      
      const fileContent = await readFileTool({ filePath }, { context: { projectPath: input.projectPath } } as any);
      
      console.log(`[AGENT-MANUAL-LOOP] Contenuto file ottenuto. Chiedo all'AI di analizzarlo...`);
      
      // Chiamata di follow-up con il contenuto del file
      const followUpResponse = await ai.generate({
        model: selectedModel as any,
        history: [...(input.history || []), { role: 'user', content: input.developmentTask }, { role: 'assistant', content: text }] as any,
        prompt: `Ecco il contenuto del file '${filePath}':\n\n${fileContent}\n\nBasandoti su questo codice, rispondi alla mia domanda originale: "${input.developmentTask}"`,
      });
      
      text = followUpResponse.text || "";
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[AGENT-RESPONSE] Caratteri ricevuti: ${text.length}`);
    console.log(`[AGENT-RESPONSE-PREVIEW] ${text.substring(0, 150).replace(/\n/g, ' ')}...`);
    console.log(`[AGENT-END] Operazione completata in ${duration}s.`);

    let plan = [];
    const planMatch = text.match(/<PLAN>([\s\S]*?)<\/PLAN>/);
    if (planMatch) {
      try { plan = JSON.parse(planMatch[1].trim()); } catch (e) {}
    }

    return {
      content: text.replace(/<PLAN>[\s\S]*?<\/PLAN>/g, '').trim() || "Il modello non ha prodotto testo. Prova a cambiare modello o essere più specifico.",
      plan: plan.length > 0 ? plan : undefined
    };
  } catch (error: any) {
    console.error(`[AGENT-ERROR] Errore critico:`, error.message);
    return { 
      content: `Errore: ${error.message}. Verifica che Ollama sia attivo con 'ollama list'.`,
      plan: [{ step: "Riavvia Ollama" }] 
    };
  }
}