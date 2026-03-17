"use client";

import * as React from "react";
import { 
  FileCode, 
  Cpu, 
  FolderOpen,
  RefreshCw,
  FileSearch,
  Database,
  Check,
  Trash2
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
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getFilesToProcess, indexFileSemantic, saveProjectIndex, listIndexedProjects, loadProjectIndex } from "@/ai/flows/ai-codebase-indexing";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ProjectSidebar() {
  const [projectPath, setProjectPath] = React.useState("");
  const [isIndexing, setIsIndexing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [currentFile, setCurrentFile] = React.useState("");
  const [files, setFiles] = React.useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = React.useState<{name: string, fileName: string}[]>([]);
  const [activeProject, setActiveProject] = React.useState<string | null>(null);
  const { toast } = useToast();

  // Carica i progetti disponibili all'avvio
  const refreshProjectsList = React.useCallback(async () => {
    const projects = await listIndexedProjects();
    setAvailableProjects(projects);
  }, []);

  React.useEffect(() => {
    refreshProjectsList();
    // Recupera l'ultimo progetto attivo se esiste
    const lastProject = localStorage.getItem('activeProjectName');
    const lastPath = localStorage.getItem(`path_${lastProject}`);
    if (lastProject) {
      setActiveProject(lastProject);
      if (lastPath) setProjectPath(lastPath);
      loadProjectIndex(lastProject).then(setFiles);
    }
  }, [refreshProjectsList]);

  const handleSelectProject = async (projectName: string) => {
    setActiveProject(projectName);
    const indexData = await loadProjectIndex(projectName);
    setFiles(indexData);
    
    // Recupera il path salvato per questo progetto
    const savedPath = localStorage.getItem(`path_${projectName}`);
    if (savedPath) {
      setProjectPath(savedPath);
      localStorage.setItem('activeProjectPath', savedPath);
    }
    
    localStorage.setItem('activeProjectName', projectName);
    localStorage.setItem('activeProjectIndex', projectName);
    
    toast({
      title: "Progetto Selezionato",
      description: `Contesto per '${projectName}' caricato.`,
    });
  };

  const handleIndex = async (explicitPath?: string) => {
    const targetPath = explicitPath || projectPath;
    if (!targetPath) {
      toast({ title: "Errore", description: "Inserisci un percorso valido", variant: "destructive" });
      return;
    }

    setIsIndexing(true);
    setProgress(0);
    
    try {
      console.log(`[SIDEBAR] Avvio indicizzazione per: ${targetPath}`);
      const fileList = await getFilesToProcess(targetPath);
      const total = fileList.length;
      
      if (total === 0) {
        toast({ title: "Nessun file trovato", variant: "destructive" });
        setIsIndexing(false);
        return;
      }

      const projectName = targetPath.split(/[/\\]/).pop() || 'project-index';
      const indexedResults = [];
      
      for (let i = 0; i < total; i++) {
        const relativePath = fileList[i];
        setCurrentFile(relativePath);
        const result = await indexFileSemantic({ projectPath: targetPath, relativeFilePath: relativePath });
        indexedResults.push(result);
        
        // Aggiornamento progressivo dell'UI
        if ((i + 1) % 5 === 0 || i === total - 1) {
          setProgress(Math.round(((i + 1) / total) * 100));
          setFiles([...indexedResults]);
        }

        // SALVATAGGIO INCREMENTALE OGNI 10 FILE
        if ((i + 1) % 10 === 0) {
          await saveProjectIndex(indexedResults, projectName);
        }
      }

      // Salvataggio finale
      await saveProjectIndex(indexedResults, projectName);
      
      // Memorizza il path per il futuro
      localStorage.setItem(`path_${projectName}`, targetPath);
      localStorage.setItem('activeProjectPath', targetPath);
      localStorage.setItem('activeProjectName', projectName);
      localStorage.setItem('activeProjectIndex', projectName);

      toast({ title: "Completato", description: `Indice per '${projectName}' aggiornato con successo.` });
      refreshProjectsList();
      setActiveProject(projectName);
    } catch (error) {
      console.error("[INDEX-ERROR]", error);
      toast({ variant: "destructive", title: "Errore durante l'indicizzazione" });
    } finally {
      setIsIndexing(false);
      setCurrentFile("");
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-headline font-bold text-sm tracking-tight">AGENTIC DEVKIT</span>
            <span className="text-[10px] text-muted-foreground font-mono">v1.2-agent</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary/70 text-[10px] uppercase font-bold tracking-wider">Nuovo Progetto</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 pb-4">
            <div className="flex flex-col gap-2">
              <Input 
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="C:\Percorso\Progetto..."
                className="h-8 text-[11px] bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/50"
              />
              <Button 
                onClick={() => handleIndex()} 
                disabled={isIndexing || !projectPath} 
                size="sm" 
                className="h-8 font-bold w-full shadow-sm"
              >
                {isIndexing ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> : <FolderOpen className="mr-2 h-3 w-3" />}
                {isIndexing ? "Analisi..." : "Indicizza Ora"}
              </Button>
              {isIndexing && (
                <div className="space-y-2 mt-2 px-1">
                  <Progress value={progress} className="h-1" />
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                    <span className="truncate max-w-[100px] italic">{currentFile}</span>
                    <span className="font-bold">{progress}%</span>
                  </div>
                </div>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
            <Database size={12} className="text-primary" />
            Progetti Salvati
          </SidebarGroupLabel>
          <SidebarMenu>
            {availableProjects.length === 0 && !isIndexing && (
              <div className="px-4 py-2">
                <p className="text-[10px] text-muted-foreground italic">Nessun indice trovato.</p>
              </div>
            )}
            {availableProjects.map((p) => (
              <SidebarMenuItem key={p.name}>
                <SidebarMenuButton 
                  onClick={() => handleSelectProject(p.name)}
                  isActive={activeProject === p.name}
                  className={cn(
                    "transition-all",
                    activeProject === p.name && "bg-primary/10 text-primary border-r-2 border-primary rounded-none"
                  )}
                >
                  <Database className="h-3.5 w-3.5" />
                  <span className="flex-1 text-xs truncate">{p.name}</span>
                  {activeProject === p.name && <Check size={12} className="shrink-0" />}
                </SidebarMenuButton>
                <SidebarMenuAction 
                  showOnHover 
                  onClick={() => handleIndex(localStorage.getItem(`path_${p.name}`) || undefined)}
                  className="hover:text-primary"
                  title="Aggiorna Indice"
                >
                  <RefreshCw size={12} className={cn(isIndexing && activeProject === p.name && "animate-spin")} />
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
            <FileSearch size={12} className="text-accent" />
            Esplora File ({files.length})
          </SidebarGroupLabel>
          <SidebarMenu>
            {files.length === 0 ? (
              <div className="px-4 py-8 text-center opacity-50">
                <FileCode size={24} className="mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-[10px] italic">Seleziona un progetto per vedere i file.</p>
              </div>
            ) : (
              files.map((file, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton tooltip={file.filePath} className="h-7">
                    <FileCode className="h-3.5 w-3.5 text-accent/50" />
                    <span className="text-[11px] truncate">{file.filePath.split(/[/\\]/).pop()}</span>
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
