import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Building2, Plus, X } from "lucide-react";
import { TransactionFieldsCard } from "@/components/configuracoes/TransactionFieldsCard";
import { useAuth } from "@/contexts/AuthContext";
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
  const { companies, refetchCompanies } = useCompany();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  const handleAddCompany = async () => {
    if (!companyName.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    if (!user) return;
    setSavingCompany(true);
    try {
      const { error } = await supabase.from("companies").insert({
        name: companyName.trim(),
        cnpj: companyCnpj.trim(),
        user_id: user.id,
      });
      if (error) throw error;
      toast.success("Empresa cadastrada com sucesso!");
      setCompanyName("");
      setCompanyCnpj("");
      setShowCompanyForm(false);
      refetchCompanies();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar empresa");
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
    if (confirmText !== "EXCLUIR") return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para excluir sua conta.");
        return;
      }

      const res = await fetch(
        `https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir conta");
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Preferências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Email:</strong> {user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Empresas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Empresas
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowCompanyForm(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Nova Empresa
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showCompanyForm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cadastrar empresa</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCompanyForm(false)}>
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
              <Button size="sm" onClick={handleAddCompany} disabled={savingCompany}>
                {savingCompany ? "Salvando..." : "Cadastrar"}
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
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteCompany(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

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
                  Esta ação é irreversível. Todos os seus lançamentos, contas, categorias, contatos e demais dados serão permanentemente excluídos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Digite <strong>EXCLUIR</strong> para confirmar:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="EXCLUIR"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "EXCLUIR" || deleting}
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
