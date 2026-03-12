"use client";

import * as React from "react";
import { 
  FolderIcon, 
  FileCode, 
  Search, 
  Cpu, 
  Plus, 
  FolderOpen,
  ChevronRight,
  RefreshCw
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
import { aiCodebaseIndexing } from "@/ai/flows/ai-codebase-indexing";
import { useToast } from "@/hooks/use-toast";

export function ProjectSidebar() {
  const [projectPath, setProjectPath] = React.useState("C:\\Workspaces\\tecno-asset");
  const [isIndexing, setIsIndexing] = React.useState(false);
  const [files, setFiles] = React.useState<any[]>([]);
  const { toast } = useToast();

  const handleIndex = async () => {
    if (!projectPath) return;
    setIsIndexing(true);
    try {
      const result = await aiCodebaseIndexing({ projectPath });
      setFiles(result);
      toast({
        title: "Indexing Complete",
        description: `Successfully indexed ${result.length} files.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Indexing Failed",
        description: "An error occurred while scanning the project.",
      });
    } finally {
      setIsIndexing(false);
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
            <div className="flex flex-col gap-2">
              <Input 
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="Project Directory..."
                className="h-8 text-xs bg-muted/30 border-none"
              />
              <Button 
                onClick={handleIndex} 
                disabled={isIndexing}
                size="sm" 
                className="h-8 font-semibold"
              >
                {isIndexing ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> : <FolderOpen className="mr-2 h-3 w-3" />}
                {isIndexing ? "Indexing..." : "Index Project"}
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Files Explorer</SidebarGroupLabel>
          <SidebarMenu>
            {files.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">Index a project to see files.</p>
              </div>
            ) : (
              files.map((file, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton tooltip={file.filePath}>
                    <FileCode className="h-4 w-4 text-accent" />
                    <span>{file.filePath.split('/').pop()}</span>
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
              <span>Global Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
