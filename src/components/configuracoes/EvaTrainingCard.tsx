import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Upload, FileText, Trash2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EvaTrainingCard() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (effectiveUserId) fetchFiles();
  }, [effectiveUserId, selectedCompanyId, isPersonal]);

  const fetchFiles = async () => {
    let q = supabase.from("eva_knowledge").select("*").eq("user_id", effectiveUserId);
    
    if (isPersonal) {
      q = q.is("company_id", null);
    } else if (selectedCompanyId) {
      q = q.eq("company_id", selectedCompanyId);
    }

    const { data, error } = await q.order("created_at", { ascending: false });
    if (!error && data) {
      setFiles(data);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!effectiveUserId) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${effectiveUserId}/${crypto.randomUUID()}.${fileExt}`;

    setUploading(true);
    try {
      // 1. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("eva-knowledge")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Add to table
      const { error: dbError } = await supabase.from("eva_knowledge").insert({
        user_id: effectiveUserId,
        company_id: selectedCompanyId || null,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_path: filePath,
        status: "active"
      });

      if (dbError) throw dbError;

      toast.success("Arquivo enviado com sucesso. A EVA já pode usá-lo como base de conhecimento!");
      fetchFiles();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar arquivo: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string, path: string) => {
    try {
      await supabase.from("eva_knowledge").delete().eq("id", id);
      await supabase.storage.from("eva-knowledge").remove([path]);
      setFiles(files.filter(f => f.id !== id));
      toast.success("Arquivo removido.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover arquivo.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          Treinamento da EVA
        </CardTitle>
        <CardDescription>
          Faça upload de regras de negócio, tabelas de preço ou procedimentos. 
          A EVA lerá esses arquivos para responder às dúvidas com mais precisão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
          <Label htmlFor="knowledge-upload" className="text-sm font-medium cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {uploading ? "Enviando..." : "Selecionar Arquivo"}
          </Label>
          <Input 
            id="knowledge-upload" 
            type="file" 
            accept=".pdf,.txt,.csv,.doc,.docx" 
            className="hidden" 
            onChange={handleUpload}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground mt-3">
            Formatos suportados: PDF, TXT, CSV, DOC, DOCX.
          </p>
        </div>

        {files.length > 0 && (
          <div className="space-y-3 mt-6">
            <h4 className="text-sm font-medium">Arquivos de Treinamento</h4>
            <div className="space-y-2">
              {files.map(file => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20 px-2 py-1 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Ativo
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(file.id, file.file_path)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
