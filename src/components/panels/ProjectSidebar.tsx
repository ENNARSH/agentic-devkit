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
  ChevronDown,
  Layers
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFilesToProcess, indexFileSemantic, saveProjectIndex, listIndexedProjects, loadProjectIndex } from "@/ai/flows/ai-codebase-indexing";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Lista dei modelli aggiornata sulla base di 'ollama list' dell'utente
const AVAILABLE_MODELS = [
  { id: "gemma3:latest", name: "Gemma 3 (Multimodale)", type: "general" },
  { id: "gemma3:4b", name: "Gemma 3 4B", type: "general" },
  { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B", type: "code" },
  { id: "qwen2.5-coder:14b", name: "Qwen 2.5 Coder 14B", type: "code" },
  { id: "deepseek-r1:8b", name: "DeepSeek R1 8B", type: "logic" },
  { id: "llama3.1:latest", name: "Llama 3.1 8B", type: "general" },
  { id: "mistral:latest", name: "Mistral 7B", type: "general" },
  { id: "gpt-oss:20b", name: "GPT OSS 20B", type: "large" },
];

export function ProjectSidebar() {
  const [projectPath, setProjectPath] = React.useState("");
  const [isIndexing, setIsIndexing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [currentFile, setCurrentFile] = React.useState("");
  const [files, setFiles] = React.useState<any[]>([]);
  const [availableProjects, setAvailableProjects] = React.useState<{name: string, fileName: string}[]>([]);
  const [activeProject, setActiveProject] = React.useState<string | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<string>("qwen2.5-coder:7b");
  const { toast } = useToast();

  const refreshProjectsList = React.useCallback(async () => {
    const projects = await listIndexedProjects();
    setAvailableProjects(projects);
  }, []);

  React.useEffect(() => {
    refreshProjectsList();
    const lastProject = localStorage.getItem('activeProjectName');
    const lastPath = localStorage.getItem(`path_${lastProject}`);
    const lastModel = localStorage.getItem('selectedModel');
    
    if (lastModel) setSelectedModel(lastModel);
    
    if (lastProject) {
      setActiveProject(lastProject);
      if (lastPath) setProjectPath(lastPath);
      loadProjectIndex(lastProject).then(setFiles);
    }
  }, [refreshProjectsList]);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    localStorage.setItem('selectedModel', value);
    toast({
      title: "Modello Cambiato",
      description: `L'agente userà ora ${value}`,
    });
  };

  const handleSelectProject = async (projectName: string) => {
    setActiveProject(projectName);
    const indexData = await loadProjectIndex(projectName);
    setFiles(indexData);
    
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
        
        if ((i + 1) % 5 === 0 || i === total - 1) {
          setProgress(Math.round(((i + 1) / total) * 100));
          setFiles([...indexedResults]);
        }

        if ((i + 1) % 10 === 0) {
          await saveProjectIndex(indexedResults, projectName);
        }
      }

      await saveProjectIndex(indexedResults, projectName);
      localStorage.setItem(`path_${projectName}`, targetPath);
      localStorage.setItem('activeProjectPath', targetPath);
      localStorage.setItem('activeProjectName', projectName);
      localStorage.setItem('activeProjectIndex', projectName);

      toast({ title: "Completato", description: `Indice per '${projectName}' aggiornato.` });
      refreshProjectsList();
      setActiveProject(projectName);
    } catch (error) {
      toast({ variant: "destructive", title: "Errore indicizzazione" });
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
          <SidebarGroupLabel className="text-primary/70 text-[10px] uppercase font-bold tracking-wider">Modello Intelligenza</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 pb-2">
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8 text-[11px] bg-muted/30 border-none">
                <div className="flex items-center gap-2">
                  <Layers size={12} className="text-primary" />
                  <SelectValue placeholder="Seleziona Modello" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarGroupContent>
        </SidebarGroup>

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
                <p className="text-[10px] italic">Seleziona un progetto.</p>
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
