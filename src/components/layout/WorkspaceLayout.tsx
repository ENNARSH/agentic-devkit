"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectSidebar } from "@/components/panels/ProjectSidebar";
import { AgentPanel } from "@/components/panels/AgentPanel";
import { OutputPanel } from "@/components/panels/OutputPanel";
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";

export function WorkspaceLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <ProjectSidebar />
        <SidebarInset className="flex flex-col h-full w-full overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-sidebar/50">
            <h2 className="text-sm font-headline font-semibold tracking-tight text-primary">
              AGENTIC DEVKIT <span className="text-muted-foreground font-normal ml-2">/ main</span>
            </h2>
          </header>
          
          <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
            <ResizablePanel defaultSize={60} minSize={30} className="flex flex-col border-r">
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={70} minSize={20} className="relative flex flex-col">
                  {/* Main Interaction/Editor Area */}
                  <AgentPanel />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={10} className="flex flex-col bg-sidebar/20">
                  {/* Console/Output/Logs */}
                  <OutputPanel />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={20} className="hidden lg:flex flex-col bg-card/30">
              {/* Secondary Context/Analysis Panel */}
              <div className="p-4 border-b bg-muted/20">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contextual Analysis</h3>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border bg-card/50">
                    <h4 className="text-sm font-medium mb-2 text-primary">File Insight</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Select a file or prompt the agent to see contextual analysis here. The agent will automatically index your project for better understanding.
                    </p>
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

// Minimal resizable components for consistency
const Resizable = {
  PanelGroup: ResizablePanelGroup,
  Panel: ResizablePanel,
  Handle: ResizableHandle
};
