import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Upload, FileText, Trash2, CheckCircle2, MessageSquareText, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapDatabaseError } from "@/lib/errorMapper";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export function EvaTrainingCard() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const [customPrompt, setCustomPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  useEffect(() => {
    if (effectiveUserId) {
      fetchFiles();
      loadCustomPrompt();
    }
  }, [effectiveUserId, selectedCompanyId, isPersonal]);

  const loadCustomPrompt = () => {
    const contextKey = isPersonal ? "personal" : (selectedCompanyId || "all");
    const storageKey = `eva_custom_prompt_${effectiveUserId}_${contextKey}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setCustomPrompt(saved);
    } else {
      setCustomPrompt("");
    }
  };

  const saveCustomPrompt = () => {
    if (!effectiveUserId) return;
    setSavingPrompt(true);
    try {
      const contextKey = isPersonal ? "personal" : (selectedCompanyId || "all");
      const storageKey = `eva_custom_prompt_${effectiveUserId}_${contextKey}`;
      localStorage.setItem(storageKey, customPrompt);
      toast.success("Instruções personalizadas salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar instruções personalizadas.");
    } finally {
      setSavingPrompt(false);
    }
  };

  const fetchFiles = async () => {
    let q = (supabase as any).from("eva_knowledge").select("*").eq("user_id", effectiveUserId);
    
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo é maior que 10 MB. Envie um arquivo menor.");
      e.target.value = '';
      return;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!["pdf", "txt", "csv", "docx"].includes(ext)) {
      toast.error("Formato não suportado. Use PDF, TXT, CSV ou DOCX.");
      e.target.value = '';
      return;
    }
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
      const { data: inserted, error: dbError } = await (supabase as any).from("eva_knowledge").insert({
        user_id: effectiveUserId,
        company_id: selectedCompanyId || null,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_path: filePath,
        status: "pending"
      }).select("id").single();

      if (dbError) throw dbError;

      toast.success("Arquivo enviado! A EVA está lendo o conteúdo...");
      fetchFiles();
      const { data: res } = await supabase.functions.invoke("process-knowledge-file", { body: { id: inserted.id } });
      if (res?.ok) toast.success("Pronto! A EVA já usa este arquivo nas respostas.");
      else toast.error(res?.error || "Não foi possível ler o arquivo.");
      fetchFiles();
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível enviar o arquivo: " + (err?.code ? mapDatabaseError(err) : "tente novamente."));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string, path: string) => {
    try {
      await (supabase as any).from("eva_knowledge").delete().eq("id", id);
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
          Personalize a forma como a EVA interage com você e sua empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Custom Prompt Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Instruções de Personalidade (Prompt)</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Escreva como você deseja que a EVA responda às suas perguntas. 
            Você pode definir o tom de voz, regras de atendimento, ou instruções específicas.
          </p>
          <Textarea 
            placeholder="Ex: Você é a EVA, a assistente financeira oficial da empresa X. Sempre responda de forma profissional, direta e chame os clientes pelo primeiro nome..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="min-h-[120px] text-sm resize-y"
          />
          <div className="flex justify-end">
            <Button onClick={saveCustomPrompt} disabled={savingPrompt} size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              {savingPrompt ? "Salvando..." : "Salvar Instruções"}
            </Button>
          </div>
        </div>

        <Separator />

        {/* File Upload Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Base de Conhecimento (Arquivos)</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Faça upload de regras de negócio, tabelas de preço ou procedimentos que a EVA deve ler.
          </p>
          
          <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-3" />
            <Label htmlFor="knowledge-upload" className="text-sm font-medium cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
              {uploading ? "Enviando..." : "Selecionar Arquivo"}
            </Label>
            <Input 
              id="knowledge-upload" 
              type="file" 
              accept=".pdf,.txt,.csv,.docx" 
              className="hidden" 
              onChange={handleUpload}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground mt-3">
              Formatos suportados: PDF, TXT, CSV, DOCX (até 10 MB).
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-3 mt-4">
              <h4 className="text-sm font-medium">Arquivos Enviados</h4>
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
                      {file.status === "active" ? (
                        <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </span>
                      ) : file.status === "error" ? (
                        <span title={file.error || ""} className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-full">Erro</span>
                      ) : (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Processando</span>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(file.id, file.file_path)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
