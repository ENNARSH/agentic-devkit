"use client";

import * as React from "react";
import { Send, Bot, User, Sparkles, Terminal, BookOpen, AlertCircle, CheckCircle2 } from "lucide-react";
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
};

export function AgentPanel() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am your Agentic DevKit assistant. How can I help you with your project today? You can ask me to analyze code, find files, or plan complex development tasks.",
    },
  ]);
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await agenticTaskPlanning({ developmentTask: input });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I've analyzed your request and prepared a step-by-step action plan:",
        plan: result.plan,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I encountered an error while trying to process your request. Please ensure you've indexed the project first.",
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
                  "flex gap-4 p-4 rounded-xl border transition-all",
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
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                    {message.content}
                  </div>
                  
                  {message.plan && (
                    <div className="space-y-3 mt-4">
                      {message.plan.map((step, idx) => (
                        <div key={idx} className="flex gap-3 items-start p-3 rounded-lg bg-background/50 border border-border group hover:border-primary/50 transition-colors">
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium mb-1">{step.step}</p>
                            {step.tool && (
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground flex items-center gap-1">
                                  <Terminal size={10} /> {step.tool}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-code truncate opacity-60">
                                  {JSON.stringify(step.toolInput)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary">
                              <CheckCircle2 size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4 p-4 rounded-xl border bg-secondary/20 border-border animate-pulse">
                <div className="h-8 w-8 rounded-full bg-primary/50 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative group">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Describe a task or ask about your code..."
            className="min-h-[60px] pr-14 py-3 bg-muted/20 focus-visible:ring-primary/30 transition-all resize-none font-body text-sm"
          />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <Button 
              type="submit" 
              size="icon" 
              disabled={isLoading || !input.trim()}
              className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 transition-all"
            >
              <Send size={16} />
            </Button>
          </div>
        </form>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-muted-foreground tracking-wide flex items-center justify-center gap-2">
            <Sparkles size={10} className="text-primary" />
            AI agent can read, search and analyze your project context
          </p>
        </div>
      </div>
    </div>
  );
}
