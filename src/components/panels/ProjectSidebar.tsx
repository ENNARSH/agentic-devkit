"use client";

import * as React from "react";
import { 
  FileCode, 
  Search, 
  Cpu, 
  FolderOpen,
  RefreshCw,
  FileSearch
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
import { getFilesToProcess, indexFileSemantic, saveProjectIndex } from "@/ai/flows/ai-codebase-indexing";
import { useToast } from "@/hooks/use-toast";

export function ProjectSidebar() {
  const [projectPath, setProjectPath] = React.useState("C:\\Workspaces\\tecno-asset");
  const [isIndexing, setIsIndexing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [currentFile, setCurrentFile] = React.useState("");
  const [files, setFiles] = React.useState<any[]>([]);
  const { toast } = useToast();

  const handleIndex = async () => {
    if (!projectPath) return;
    setIsIndexing(true);
    setProgress(0);
    setFiles([]);
    
    try {
      const fileList = await getFilesToProcess(projectPath);
      const total = fileList.length;
      
      if (total === 0) {
        toast({
          title: "Nessun file trovato",
          description: "Non sono stati trovati file indicizzabili nel percorso specificato.",
        });
        setIsIndexing(false);
        return;
      }

      const indexedResults = [];
      
      for (let i = 0; i < total; i++) {
        const relativePath = fileList[i];
        setCurrentFile(relativePath);
        
        console.log(`[CLIENT] Indicizzazione file ${i + 1}/${total}: ${relativePath}`);
        
        try {
          const result = await indexFileSemantic({ 
            projectPath, 
            relativeFilePath: relativePath 
          });
          indexedResults.push(result);
          setFiles((prev) => [...prev, result]);
          
          // Salvataggio progressivo ogni 10 file per permettere all'utente di vedere i risultati
          if ((i + 1) % 10 === 0 || i === total - 1) {
            await saveProjectIndex(indexedResults);
          }

          // Piccolo delay per non saturare Ollama
          await new Promise(r => setTimeout(r, 100));
        } catch (fileErr) {
          console.error(`Errore su ${relativePath}`, fileErr);
        }
        
        const nextProgress = Math.round(((i + 1) / total) * 100);
        setProgress(nextProgress);
      }

      toast({
        title: "Indicizzazione Completata",
        description: `Salvati ${indexedResults.length} file nell'indice locale.`,
      });
    } catch (error) {
      console.error("Errore fatale indicizzazione:", error);
      toast({
        variant: "destructive",
        title: "Errore Indicizzazione",
        description: "Controlla i log nel terminale per maggiori dettagli.",
      });
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
          <SidebarGroupLabel className="text-primary/70">Project Path</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 pb-2">
            <div className="flex flex-col gap-3">
              <Input 
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="Percorso assoluto progetto..."
                className="h-8 text-xs bg-muted/30 border-none"
              />
              <Button 
                onClick={handleIndex} 
                disabled={isIndexing}
                size="sm" 
                className="h-8 font-semibold w-full"
              >
                {isIndexing ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> : <FolderOpen className="mr-2 h-3 w-3" />}
                {isIndexing ? "Indicizzazione..." : "Index Project"}
              </Button>
              
              {isIndexing && (
                <div className="space-y-2 px-1">
                  <Progress value={progress} className="h-1.5" />
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[120px]">{currentFile}</span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                </div>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <FileSearch size={14} />
            Files Explorer
          </SidebarGroupLabel>
          <SidebarMenu>
            {files.length === 0 && !isIndexing ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">Indicizza un progetto per vedere i file.</p>
              </div>
            ) : (
              files.map((file, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton tooltip={file.filePath}>
                    <FileCode className="h-4 w-4 text-accent" />
                    <span>{file.filePath.split(/[/\\]/).pop()}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground hover:text-primary">
              <Search className="h-4 w-4" />
              <span>Ricerca Globale</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
