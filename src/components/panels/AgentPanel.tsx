"use client";

import * as React from "react";
import { Send, Bot, User, Sparkles, Terminal, CheckCircle2, Search, Code2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { agenticTaskPlanning, AgenticTaskPlanningOutput } from "@/ai/flows/agentic-task-planning";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: AgenticTaskPlanningOutput["plan"];
  suggestions?: string[];
};

export function AgentPanel() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Pronto ad aiutarti! Seleziona un progetto dalla sidebar o chiedimi di analizzare qualcosa.",
      suggestions: [
        "Quali sono i file principali del progetto?",
        "Quali sono i file che gestiscono i database?",
        "Crea un piano per aggiungere una nuova rotta API",
        "Trova dove viene definita la gestione degli errori"
      ]
    },
  ]);
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const activeProject = localStorage.getItem('activeProjectIndex');
    console.log(`[DEBUG-CLIENT] Invio richiesta agente per progetto: ${activeProject || 'nessuno'}`);
    console.log(`[DEBUG-CLIENT] Messaggio: "${text}"`);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await agenticTaskPlanning({ 
        developmentTask: text,
        projectName: activeProject || undefined 
      });
      
      console.log(`[DEBUG-CLIENT] Risposta ricevuta dall'agente:`, result);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: activeProject 
          ? `Analisi completata per il progetto "${activeProject}":` 
          : "Ecco cosa ho trovato nell'indice disponibile:",
        plan: result.plan,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(`[DEBUG-CLIENT] Errore chiamata agente:`, error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Ops! Qualcosa è andato storto. Verifica che Ollama sia attivo e che il progetto sia stato selezionato nella sidebar.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/20">
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full px-6 py-8" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4 p-5 rounded-xl border transition-all animate-in fade-in slide-in-from-bottom-2",
                  message.role === "assistant" 
                    ? "bg-secondary/20 border-border" 
                    : "bg-background border-primary/20 shadow-sm shadow-primary/5"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  message.role === "assistant" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-accent text-accent-foreground"
                )}>
                  {message.role === "assistant" ? <Bot size={18} /> : <User size={18} />}
                </div>
                <div className="flex-1 space-y-4">
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                    {message.content}
                  </div>
                  
                  {message.suggestions && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {message.suggestions.map((suggestion, i) => (
                        <Button 
                          key={i} 
                          variant="outline" 
                          size="sm" 
                          className="text-[11px] h-7 bg-background/50 hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                          onClick={() => handleSubmit(suggestion)}
                        >
                          <Sparkles size={10} className="mr-1.5" />
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  )}

                  {message.plan && (
                    <div className="space-y-3 mt-4">
                      {message.plan.map((step, idx) => (
                        <div key={idx} className="flex gap-3 items-start p-4 rounded-lg bg-background/50 border border-border group hover:border-primary/30 transition-all hover:shadow-md">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium mb-1 leading-snug">{step.step}</p>
                            {step.tool && (
                              <div className="flex items-center gap-2 mt-3">
                                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted/50 text-muted-foreground flex items-center gap-1.5 font-code">
                                  <Terminal size={10} /> {step.tool}
                                </Badge>
                                {step.toolInput && (
                                  <span className="text-[10px] text-muted-foreground font-code truncate opacity-60">
                                    {typeof step.toolInput === 'string' ? step.toolInput : JSON.stringify(step.toolInput)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4 p-5 rounded-xl border bg-secondary/20 border-border animate-pulse">
                <div className="h-8 w-8 rounded-full bg-primary/30 shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="p-6 border-t bg-background/80 backdrop-blur-md">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }} 
          className="max-w-4xl mx-auto relative group"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(input);
              }
            }}
            placeholder="Chiedi all'agente di analizzare o pianificare qualcosa..."
            className="min-h-[80px] pr-14 py-4 bg-muted/10 border-border/50 focus-visible:ring-primary/20 transition-all resize-none font-body text-sm rounded-xl"
          />
          <div className="absolute right-4 bottom-4 flex gap-2">
            <Button 
              type="submit" 
              size="icon" 
              disabled={isLoading || !input.trim()}
              className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <Send size={18} />
            </Button>
          </div>
        </form>
        <div className="mt-3 flex items-center justify-center gap-6">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Search size={10} className="text-primary" /> Ricerca Semantica
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <ListChecks size={10} className="text-primary" /> Agentic Planning
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Code2 size={10} className="text-primary" /> Analisi Codebase
          </span>
        </div>
      </div>
    </div>
  );
}
