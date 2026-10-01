import { useState, useEffect, useCallback } from "react";
import { GraduationCap, Wallet, ArrowUpCircle, ArrowDownCircle, PlusCircle, Settings, History, CalendarIcon, ChevronLeft, Baby, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

// Prefix used to identify Kids wallets
const KIDS_WALLET_PREFIX = "Kids - ";

interface KidsWallet {
  id: string;
  name: string;
}

// ─── Parent: only fetches wallets directly, never transactions ───
export default function EvaKids() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();

  const [kidsWallets, setKidsWallets] = useState<KidsWallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [isAddKidModalOpen, setIsAddKidModalOpen] = useState(false);
  const [newKidName, setNewKidName] = useState("");

  // Fetch only Kids wallets — no useTransactions, no transaction errors
  const fetchKidsWallets = useCallback(async () => {
    if (!effectiveUserId) return;
    setWalletsLoading(true);

    let query = supabase
      .from("wallets")
      .select("id, name")
      .eq("user_id", effectiveUserId)
      .like("name", `${KIDS_WALLET_PREFIX}%`)
      .order("name");

    if (isPersonal) {
      query = query.is("company_id", null);
    } else if (selectedCompanyId) {
      query = query.eq("company_id", selectedCompanyId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setKidsWallets(data);
    }
    setWalletsLoading(false);
  }, [effectiveUserId, isPersonal, selectedCompanyId]);

  useEffect(() => {
    fetchKidsWallets();
  }, [fetchKidsWallets]);

  const handleAddKid = async () => {
    const name = newKidName.trim();
    if (!name) {
      toast.error("Digite o nome da criança.");
      return;
    }
    if (!effectiveUserId) return;

    const walletName = `${KIDS_WALLET_PREFIX}${name}`;

    // Check if already exists
    if (kidsWallets.some(w => w.name.toLowerCase() === walletName.toLowerCase())) {
      toast.error("Já existe uma conta com esse nome.");
      return;
    }

    const insertData: any = { name: walletName, user_id: effectiveUserId };
    if (!isPersonal && selectedCompanyId) {
      insertData.company_id = selectedCompanyId;
    }

    const { error } = await supabase.from("wallets").insert(insertData);
    if (error) {
      toast.error("Erro ao criar conta para a criança.");
      console.error(error);
      return;
    }

    toast.success(`Conta de ${name} criada com sucesso!`);
    setIsAddKidModalOpen(false);
    setNewKidName("");
    fetchKidsWallets();
  };

  const handleDeleteKid = async (wallet: KidsWallet) => {
    // First check if there are transactions linked to this wallet
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("wallet_id", wallet.id);

    if (count && count > 0) {
      toast.error(`Não é possível excluir: existem ${count} lançamento(s) vinculado(s).`);
      return;
    }

    const { error } = await supabase.from("wallets").delete().eq("id", wallet.id);
    if (error) {
      toast.error("Erro ao excluir conta.");
      return;
    }
    toast.success("Conta excluída!");
    fetchKidsWallets();
  };

  const getKidDisplayName = (wallet: KidsWallet) => {
    return wallet.name.replace(KIDS_WALLET_PREFIX, "");
  };

  const selectedWallet = kidsWallets.find(w => w.id === selectedWalletId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">EVA Kids</h1>
        </div>
        <p className="text-muted-foreground">Gerencie a mesada e as finanças das crianças de forma educativa.</p>
      </div>

      {!selectedWalletId ? (
        /* ── Kid Selection Screen ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {walletsLoading ? (
            <p className="text-sm text-muted-foreground col-span-full text-center py-12">Carregando...</p>
          ) : (
            <>
              {kidsWallets.map(wallet => (
                <Card
                  key={wallet.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors group relative"
                  onClick={() => setSelectedWalletId(wallet.id)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteKid(wallet);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <CardContent className="p-6 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <Baby className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{getKidDisplayName(wallet)}</h3>
                      <p className="text-sm text-muted-foreground">Conta Corrente</p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Add Kid Card */}
              <Card
                className="cursor-pointer border-dashed hover:border-primary/50 transition-colors bg-muted/20 shadow-none"
                onClick={() => setIsAddKidModalOpen(true)}
              >
                <CardContent className="p-6 flex flex-col items-center justify-center gap-4 text-center h-full min-h-[200px]">
                  <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                    <PlusCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">Cadastrar Criança</h3>
                    <p className="text-sm text-muted-foreground">Criar nova conta</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      ) : (
        /* ── Kid Dashboard ── */
        <div className="space-y-6 mt-4">
          <Button variant="ghost" onClick={() => setSelectedWalletId(null)} className="gap-2 -ml-4">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {selectedWallet && (
            <KidDashboard
              key={selectedWallet.id}
              wallet={selectedWallet}
              effectiveUserId={effectiveUserId!}
              displayName={getKidDisplayName(selectedWallet)}
            />
          )}
        </div>
      )}

      {/* Add Kid Modal */}
      <Dialog open={isAddKidModalOpen} onOpenChange={setIsAddKidModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cadastrar Criança</DialogTitle>
            <DialogDescription>
              Crie uma conta corrente separada para gerenciar a mesada do seu filho(a).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="kidName">Nome da Criança</Label>
              <Input
                id="kidName"
                placeholder="Ex: Anna"
                value={newKidName}
                onChange={(e) => setNewKidName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKid()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddKidModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddKid}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Kid Dashboard: self-contained, fetches its own transactions ───
function KidDashboard({
  wallet,
  effectiveUserId,
  displayName,
}: {
  wallet: KidsWallet;
  effectiveUserId: string;
  displayName: string;
}) {
  type Tx = Tables<"transactions">;

  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowance, setAllowance] = useState(50.0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"receita" | "despesa">("despesa");
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    category: "",
  });

  const fetchKidsTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  }, [wallet.id]);

  useEffect(() => {
    fetchKidsTransactions();
  }, [fetchKidsTransactions]);

  const balance = transactions.reduce((acc, curr) => {
    return curr.type === "receita" ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const openModal = (type: "receita" | "despesa") => {
    setModalType(type);
    setFormData({ title: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), category: "" });
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!formData.title || !formData.amount || !formData.date) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }

    const amountVal = parseFloat(formData.amount.replace(",", "."));
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error("Insira um valor válido.");
      return;
    }

    const payload: TablesInsert<"transactions"> = {
      user_id: effectiveUserId,
      type: modalType,
      description: formData.title,
      amount: amountVal,
      payment_date: formData.date,
      competence_date: formData.date,
      category: formData.category || "Geral",
      status: "Pago",
      wallet_id: wallet.id,
    };

    const { error } = await supabase.from("transactions").insert(payload);
    if (error) {
      toast.error("Erro ao salvar lançamento.");
      console.error(error);
      return;
    }

    toast.success("Lançamento salvo!");
    setIsModalOpen(false);
    fetchKidsTransactions();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Balance */}
      <Card className="md:col-span-2 border-primary/20 shadow-premium glow-primary-sm bg-gradient-primary-soft relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Wallet className="w-32 h-32" />
        </div>
        <CardHeader>
          <CardTitle className="text-primary flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Conta de {displayName}
          </CardTitle>
          <CardDescription>Saldo disponível para gastos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold font-display text-primary transition-all duration-300">
            {loading ? "Carregando..." : `R$ ${balance.toFixed(2).replace(".", ",")}`}
          </div>
          <div className="mt-8 flex gap-4 relative z-10">
            <Button
              onClick={() => openModal("receita")}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={loading}
            >
              <ArrowUpCircle className="h-4 w-4" />
              Adicionar Fundo
            </Button>
            <Button
              onClick={() => openModal("despesa")}
              variant="outline"
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 border-destructive/20"
              disabled={loading}
            >
              <ArrowDownCircle className="h-4 w-4" />
              Registrar Gasto
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Allowance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Regras de Mesada
          </CardTitle>
          <CardDescription>Defina o valor e frequência</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Valor da Mesada (R$)</Label>
            <Input type="number" value={allowance} onChange={(e) => setAllowance(Number(e.target.value))} className="font-medium" />
          </div>
          <div className="space-y-2">
            <Label>Frequência</Label>
            <select className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="monthly">Mensal</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
          <Button variant="secondary" className="w-full gap-2 mt-2" onClick={() => toast.success("Regras atualizadas!")}>
            <PlusCircle className="h-4 w-4" />
            Salvar Regras
          </Button>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Histórico Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada.</p>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {tx.type === "receita" ? (
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                        <ArrowUpCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                    ) : (
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                        <ArrowDownCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {tx.payment_date ? new Date(tx.payment_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                        {tx.category && <span className="ml-1 px-2 py-0.5 bg-muted rounded-full text-[10px]">{tx.category}</span>}
                      </p>
                    </div>
                  </div>
                  <div className={`font-semibold ${tx.type === "receita" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {tx.type === "receita" ? "+" : "-"} R$ {tx.amount.toFixed(2).replace(".", ",")}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{modalType === "receita" ? "Adicionar Fundo" : "Registrar Gasto"}</DialogTitle>
            <DialogDescription>
              {modalType === "receita" ? "Adicionar saldo" : "Registrar despesa"} para {displayName}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Descrição</Label>
              <Input
                id="title"
                placeholder={modalType === "receita" ? "Ex: Presente da Vó, Mesada" : "Ex: Lanche, Brinquedo"}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0,00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" placeholder="Ex: Mesada, Alimentação, Lazer" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTransaction}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
