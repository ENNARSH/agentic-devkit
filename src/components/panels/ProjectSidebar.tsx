"use client";

import * as React from "react";
import { 
  FileCode, 
  Cpu, 
  FolderOpen,
  RefreshCw,
  FileSearch,
  Database,
  Check
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getFilesToProcess, indexFileSemantic, saveProjectIndex, listIndexedProjects, loadProjectIndex } from "@/ai/flows/ai-codebase-indexing";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ProjectSidebar() {
  const [projectPath, setProjectPath] = React.useState("C:\\Workspaces\\tecno-asset");
  const [isIndexing, setIsIndexing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [currentFile, setCurrentFile] = React.useState("");
  const [files, setFiles] = React.useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = React.useState<{name: string, fileName: string}[]>([]);
  const [activeProject, setActiveProject] = React.useState<string | null>(null);
  const { toast } = useToast();

  const refreshProjects = React.useCallback(async () => {
    const projects = await listIndexedProjects();
    setAvailableProjects(projects);
  }, []);

  React.useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const handleSelectProject = async (projectName: string) => {
    setActiveProject(projectName);
    const indexData = await loadProjectIndex(projectName);
    setFiles(indexData);
    toast({
      title: "Progetto Caricato",
      description: `Il contesto per ${projectName} è ora attivo.`,
    });
    // Store active project in a way the agent can see it (simple localStorage for client-side persistence)
    localStorage.setItem('activeProjectIndex', projectName);
  };

  const handleIndex = async () => {
    if (!projectPath) return;
    setIsIndexing(true);
    setProgress(0);
    setFiles([]);
    
    try {
      const fileList = await getFilesToProcess(projectPath);
      const total = fileList.length;
      
      if (total === 0) {
        toast({ title: "Nessun file trovato", variant: "destructive" });
        setIsIndexing(false);
        return;
      }

      toast({
        title: "Inizio Indicizzazione",
        description: `Trovati ${total} file. Analisi semantica in corso...`,
      });

      const indexedResults = [];
      const projectName = projectPath.split(/[/\\]/).pop() || 'project-index';
      
      for (let i = 0; i < total; i++) {
        const relativePath = fileList[i];
        setCurrentFile(relativePath);
        const result = await indexFileSemantic({ projectPath, relativeFilePath: relativePath });
        indexedResults.push(result);
        setFiles((prev) => [...prev, result]);
        
        if ((i + 1) % 10 === 0 || i === total - 1) {
          await saveProjectIndex(indexedResults, projectName);
        }
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      toast({ title: "Indicizzazione Completata", description: "Indice salvato correttamente." });
      refreshProjects();
      setActiveProject(projectName);
      localStorage.setItem('activeProjectIndex', projectName);
    } catch (error) {
      toast({ variant: "destructive", title: "Errore Indicizzazione" });
    } finally {
      setIsIndexing(false);
      setCurrentFile("");
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Cpu className="h-5 w-5" />
          </div>
          <span className="font-headline font-bold text-lg tracking-tight group-data-[collapsible=icon]:hidden">
            DevKit
          </span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary/70">Index New Project</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 pb-2">
            <div className="flex flex-col gap-3">
              <Input 
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="Path assoluto..."
                className="h-8 text-xs bg-muted/30 border-none"
              />
              <Button onClick={handleIndex} disabled={isIndexing} size="sm" className="h-8 font-semibold w-full">
                {isIndexing ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> : <FolderOpen className="mr-2 h-3 w-3" />}
                {isIndexing ? "Indexing..." : "Index Project"}
              </Button>
              {isIndexing && (
                <div className="space-y-2 px-1">
                  <Progress value={progress} className="h-1.5" />
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[120px]">{currentFile}</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Database size={14} />
            Available Projects
          </SidebarGroupLabel>
          <SidebarMenu>
            {availableProjects.map((p) => (
              <SidebarMenuItem key={p.name}>
                <SidebarMenuButton 
                  onClick={() => handleSelectProject(p.name)}
                  isActive={activeProject === p.name}
                  className={cn(activeProject === p.name && "bg-primary/10 text-primary")}
                >
                  <Database className="h-4 w-4" />
                  <span className="flex-1">{p.name}</span>
                  {activeProject === p.name && <Check size={12} />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <FileSearch size={14} />
            Files in Project
          </SidebarGroupLabel>
          <SidebarMenu>
            {files.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] text-muted-foreground italic">Nessun file caricato.</p>
              </div>
            ) : (
              files.map((file, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton tooltip={file.filePath}>
                    <FileCode className="h-4 w-4 text-accent/70" />
                    <span className="text-[11px]">{file.filePath.split(/[/\\]/).pop()}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
