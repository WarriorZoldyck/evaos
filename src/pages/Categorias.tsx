import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderTree } from "lucide-react";

export default function Categorias() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
        <p className="text-muted-foreground text-sm mt-1">Organize receitas e despesas em categorias hierárquicas</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            Árvore de Categorias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Módulo será implementado na Fase 5
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
