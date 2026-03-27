"use client";

import * as React from "react";
import { Send, Bot, User, Sparkles, CheckCircle2, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { agenticTaskPlanning } from "@/ai/flows/agentic-task-planning";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  plan?: {
    step: string;
  }[];
  suggestions?: string[];
};

export function AgentPanel() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Pronto ad aiutarti! Seleziona un progetto e un modello dalla sidebar. Posso analizzare file di migliaia di righe leggendoli a pezzi: chiedimi pure di analizzarne la struttura.",
      suggestions: [
        "Analizza struttura MetricsRestService.java",
        "Suggerisci un piano di refactoring",
        "Cerca file duplicati",
        "Spiega la logica del database"
      ]
    },
  ]);
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const activeProject = localStorage.getItem('activeProjectName');
    const projectPath = localStorage.getItem('activeProjectPath');
    const selectedModel = localStorage.getItem('selectedModel') || "qwen2.5-coder:7b";
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const history = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const result = await agenticTaskPlanning({ 
        developmentTask: text,
        history: history,
        projectName: activeProject || undefined,
        projectPath: projectPath || undefined,
        model: selectedModel
      });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.content,
        plan: result.plan,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error(`[FRONTEND-ERROR]`, error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Ops! L'agente ha impiegato troppo tempo o c'è un errore di connessione con Ollama. Prova a ridurre la complessità della richiesta.`,
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
          <div className="max-w-4xl mx-auto space-y-8 pb-10">
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
                  message.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                )}>
                  {message.role === "assistant" ? <Bot size={18} /> : <User size={18} />}
                </div>
                <div className="flex-1 space-y-4">
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </div>
                  
                  {message.suggestions && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {message.suggestions.map((suggestion, i) => (
                        <Button 
                          key={i} 
                          variant="outline" 
                          size="sm" 
                          className="text-[11px] h-7 bg-background/50 hover:bg-primary/10"
                          onClick={() => handleSubmit(suggestion)}
                        >
                          <Sparkles size={10} className="mr-1.5" />
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  )}

                  {message.plan && (
                    <div className="mt-6 space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <ListTodo size={14} className="text-primary" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Piano d'azione proposto:</h4>
                      </div>
                      <div className="grid gap-2">
                        {message.plan.map((step, idx) => (
                          <div key={idx} className="flex gap-3 items-start p-3 rounded-lg bg-background/40 border border-border/50 group hover:border-primary/30 transition-all">
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              {idx + 1}
                            </div>
                            <p className="text-xs leading-snug text-muted-foreground group-hover:text-foreground transition-colors">{step.step}</p>
                          </div>
                        ))}
                      </div>
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
          className="max-w-4xl mx-auto relative"
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
            placeholder="Scrivi qui... (es: 'Analizza MetricsRestService.java')"
            className="min-h-[80px] pr-14 py-4 bg-muted/10 border-border/50 focus-visible:ring-primary/20 transition-all resize-none font-body text-sm rounded-xl"
          />
          <div className="absolute right-4 bottom-4">
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
      </div>
    </div>
  );
}
