import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Save, Loader2, CheckCircle2, Building2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHub } from "@/contexts/HubContext";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

type Choice = {
  owner_id: string;
  label: string;
  role: "viewer" | "editor" | "admin" | "owner";
};

export default function HubMeuWhatsApp() {
  const { user } = useAuth();
  const { isHubMember } = useHub();

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savingNumber, setSavingNumber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: prof }, { data: memberships }, { data: active }] = await Promise.all([
        supabase.from("profiles").select("whatsapp_number").eq("id", user.id).single(),
        supabase
          .from("workspace_members")
          .select("owner_id, role, status")
          .eq("member_user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("whatsapp_active_owner")
          .select("active_owner_id")
          .eq("member_user_id", user.id)
          .maybeSingle(),
      ]);

      if (prof?.whatsapp_number) setWhatsappNumber(prof.whatsapp_number);

      const ownerIds = (memberships || []).map((m: any) => m.owner_id);
      let ownerProfiles: any[] = [];
      if (ownerIds.length) {
        const { data: ops } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ownerIds);
        ownerProfiles = ops || [];
      }

      const list: Choice[] = [
        ...(memberships || []).map((m: any) => ({
          owner_id: m.owner_id,
          label: ownerProfiles.find((p) => p.id === m.owner_id)?.full_name || "Workspace",
          role: m.role,
        })),
        { owner_id: user.id, label: "Minha conta pessoal", role: "owner" },
      ];
      setChoices(list);
      setActiveOwnerId(active?.active_owner_id || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const formatDisplay = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const saveNumber = async () => {
    if (!user) return;
    const cleaned = whatsappNumber.replace(/\D/g, "");
    if (cleaned && (cleaned.length < 10 || cleaned.length > 13)) {
      toast.error("Número inválido. Use o formato: 5511999999999");
      return;
    }
    setSavingNumber(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ whatsapp_number: cleaned || null })
        .eq("id", user.id);
      if (error) throw error;
      setWhatsappNumber(cleaned);
      toast.success("Número de WhatsApp salvo!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar número");
    } finally {
      setSavingNumber(false);
    }
  };

  const setActive = async (ownerId: string) => {
    if (!user) return;
    setSwitching(ownerId);
    try {
      const { error } = await supabase
        .from("whatsapp_active_owner")
        .upsert({ member_user_id: user.id, active_owner_id: ownerId }, { onConflict: "member_user_id" });
      if (error) throw error;
      setActiveOwnerId(ownerId);
      toast.success("Workspace ativo atualizado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar workspace ativo");
    } finally {
      setSwitching(null);
    }
  };

  // Owners (not members of any hub) don't need this page
  if (!loading && !isHubMember) {
    return <Navigate to="/eva-hub/contas" replace />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu WhatsApp</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure o número que a EVA vai reconhecer e escolha em qual workspace você está trabalhando.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Número do WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Este é o número pessoal que a EVA vai usar para te identificar. Você pode alternar entre os workspaces aos
            quais foi convidado enviando comandos pelo próprio WhatsApp (ex: <em>usar 2</em>, <em>meus workspaces</em>,
            <em> sair do workspace</em>).
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Número com DDI + DDD</Label>
                <Input
                  value={formatDisplay(whatsappNumber)}
                  onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="+55 (11) 99999-9999"
                  maxLength={22}
                />
              </div>
              <Button onClick={saveNumber} disabled={savingNumber} size="sm" className="gap-1">
                {savingNumber ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Workspace ativo no WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Toda mensagem enviada pelo WhatsApp vai criar/consultar dados no workspace marcado como <strong>ativo</strong>.
            Suas permissões (papel + recursos liberados) são respeitadas em cada workspace.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando workspaces...
            </div>
          ) : choices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum workspace disponível.</p>
          ) : (
            <div className="space-y-2">
              {choices.map((c) => {
                const isActive = activeOwnerId
                  ? activeOwnerId === c.owner_id
                  : c.owner_id === user?.id;
                return (
                  <div
                    key={c.owner_id}
                    className="flex items-center justify-between gap-3 border border-border/60 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {c.owner_id === user?.id ? (
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.label}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {c.role === "owner" ? "Proprietário" : c.role}
                          </Badge>
                          {isActive && (
                            <Badge className="text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Ativo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant={isActive ? "outline" : "default"}
                      size="sm"
                      disabled={isActive || switching === c.owner_id}
                      onClick={() => setActive(c.owner_id)}
                    >
                      {switching === c.owner_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isActive ? (
                        "Em uso"
                      ) : (
                        "Usar"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
