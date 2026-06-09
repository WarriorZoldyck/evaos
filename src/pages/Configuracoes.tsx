import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Building2, Plus, X, Pencil, KeyRound } from "lucide-react";
import { TransactionFieldsCard } from "@/components/configuracoes/TransactionFieldsCard";
import { WhatsAppCard } from "@/components/configuracoes/WhatsAppCard";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Configuracoes() {
  const { user, signOut } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { companies, refetchCompanies } = useCompany();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  // Profile state
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, cpf, whatsapp_number")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || "");
          setCpf(data.cpf || "");
          setWhatsappNumber(data.whatsapp_number || "");
        }
        setProfileLoaded(true);
      });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          cpf: cpf.trim() || null,
          whatsapp_number: whatsappNumber.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEditCompany = (company: { id: string; name: string; cnpj: string }) => {
    setEditingCompanyId(company.id);
    setCompanyName(company.name);
    setCompanyCnpj(company.cnpj || "");
    setShowCompanyForm(true);
  };

  const resetCompanyForm = () => {
    setEditingCompanyId(null);
    setCompanyName("");
    setCompanyCnpj("");
    setShowCompanyForm(false);
  };

  const handleAddOrUpdateCompany = async () => {
    if (!companyName.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    if (!user) return;
    setSavingCompany(true);
    try {
      if (editingCompanyId) {
        const { error } = await supabase
          .from("companies")
          .update({ name: companyName.trim(), cnpj: companyCnpj.trim() })
          .eq("id", editingCompanyId);
        if (error) throw error;
        toast.success("Empresa atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("companies").insert({
          name: companyName.trim(),
          cnpj: companyCnpj.trim(),
          user_id: effectiveUserId,
        });
        if (error) throw error;
        toast.success("Empresa cadastrada com sucesso!");
      }
      resetCompanyForm();
      refetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar empresa");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    try {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
      toast.success("Empresa removida.");
      refetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover empresa");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.email || confirmText !== user.email) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para excluir sua conta.");
        return;
      }

      const { error: fnError } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });

      if (fnError) {
        throw new Error(fnError.message || "Erro ao excluir conta");
      }

      toast.success("Conta excluída com sucesso.");
      await signOut();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir conta");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Ajuste suas preferências</p>
      </div>

      {/* Perfil pessoal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Meu Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input value={user?.email || ""} disabled className="opacity-60" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                disabled={!profileLoaded}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                disabled={!profileLoaded}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp</Label>
              <Input
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="(00) 00000-0000"
                disabled={!profileLoaded}
              />
            </div>
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile || !profileLoaded}>
            {savingProfile ? "Salvando..." : "Salvar perfil"}
          </Button>
        </CardContent>
      </Card>

      {/* Empresas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Empresas
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetCompanyForm();
              setShowCompanyForm(true);
            }}
            className="gap-1"
          >
            <Plus className="h-4 w-4" /> Nova Empresa
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showCompanyForm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {editingCompanyId ? "Editar empresa" : "Cadastrar empresa"}
                </span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={resetCompanyForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome da empresa</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Minha Empresa Ltda" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
              </div>
              <Button size="sm" onClick={handleAddOrUpdateCompany} disabled={savingCompany}>
                {savingCompany ? "Salvando..." : editingCompanyId ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </div>
          )}
          {companies.length === 0 && !showCompanyForm && (
            <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
          )}
          {companies.map((c) => (
            <div key={c.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                {c.cnpj && <p className="text-xs text-muted-foreground">{c.cnpj}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditCompany(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteCompany(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Gerencie seu plano, vencimentos, faturas e cancelamento.</p>
          <Button variant="outline" onClick={() => (window.location.href = "/configuracoes/assinatura")}>
            Abrir minha assinatura
          </Button>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <WhatsAppCard />

      {/* Transaction Form Fields Settings */}
      <TransactionFieldsCard />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Zona de perigo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Ao excluir sua conta, todos os seus dados serão permanentemente removidos. Esta ação não pode ser desfeita.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Excluir minha conta</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
              <AlertDialogDescription>
                  Sua conta será desativada e todos os seus dados serão marcados para exclusão. Após 30 dias, os dados serão permanentemente removidos. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Digite seu email <strong>{user?.email}</strong> para confirmar:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={user?.email || ""}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={!user?.email || confirmText !== user.email || deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Excluindo..." : "Excluir permanentemente"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
