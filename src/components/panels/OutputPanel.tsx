"use client";

import * as React from "react";
import { Terminal, Activity, CheckCircle2, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

type LogEntry = {
  type: string;
  message: string;
  timestamp: string;
};

export function OutputPanel() {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Inizializziamo i log solo sul client per evitare errori di idratazione
    setLogs([
      { 
        type: "info", 
        message: "Agentic DevKit initialized.", 
        timestamp: new Date().toLocaleTimeString() 
      },
      { 
        type: "info", 
        message: "Waiting for project indexing...", 
        timestamp: new Date().toLocaleTimeString() 
      },
    ]);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="h-10 border-b bg-muted/10" />
        <div className="flex-1 bg-black/40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="output" className="flex flex-col h-full">
        <div className="px-4 border-b flex items-center justify-between bg-muted/10 h-10">
          <TabsList className="h-8 bg-transparent gap-4">
            <TabsTrigger value="output" className="h-7 text-xs px-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-none shadow-none">
              <Terminal className="mr-2 h-3 w-3" />
              Terminal
            </TabsTrigger>
            <TabsTrigger value="tasks" className="h-7 text-xs px-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-none shadow-none">
              <Activity className="mr-2 h-3 w-3" />
              Agent Logs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="output" className="flex-1 m-0 overflow-hidden bg-black/40">
          <ScrollArea className="h-full font-code text-xs p-4">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 mb-2 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
                <span className={log.type === "error" ? "text-destructive" : log.type === "success" ? "text-green-400" : "text-primary/80"}>
                  {log.message}
                </span>
              </div>
            ))}
            <div className="flex gap-2 text-primary animate-pulse">
              <span className="shrink-0">$</span>
              <span className="w-2 h-4 bg-primary" />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full p-4 space-y-4">
            <div className="border border-primary/20 rounded-lg p-3 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-primary" />
                <span className="text-xs font-semibold">Indexing Project</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Project scanned. Semantic index built for the current workspace.
              </p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold">Semantic Search</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Ready to perform semantic search across indexed files.
              </p>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
