import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, ArrowUpCircle, ArrowDownCircle, PlusCircle, History, CalendarIcon, ChevronLeft,
  Trash2, Pencil, Star, Moon, CalendarClock, Rocket, Repeat,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format, endOfMonth, endOfYear } from "date-fns";
import { toast } from "sonner";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { AllowanceRuleCard } from "@/components/kids/AllowanceRuleCard";
import { KidAvatar } from "@/components/kids/KidAvatar";
import {
  KIDS_ALLOWANCE_MARKER, KIDS_WALLET_PREFIX, type AllowanceRule, type KidGoal, type Tx,
  deleteKidGoal, fetchAllowanceRules, fetchKidGoals, formatBRL, formatShortDate,
  getNextAllowanceDate, getUpcomingAllowances, relativeDayLabel, syncAllowanceDeposits,
} from "@/lib/kids";

interface KidsWallet {
  id: string;
  name: string;
  balance?: number;
}

// ─── Parent: only fetches wallets directly, never transactions ───
export default function EvaKids() {
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();

  const [kidsWallets, setKidsWallets] = useState<KidsWallet[]>([]);
  const [rules, setRules] = useState<Record<string, AllowanceRule>>({});
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [isAddKidModalOpen, setIsAddKidModalOpen] = useState(false);
  const [newKidName, setNewKidName] = useState("");
  const [, setAvatarVersion] = useState(0);

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

    const { data: walletsData, error } = await query;
    if (error || !walletsData) {
      setWalletsLoading(false);
      return;
    }

    const walletIds = walletsData.map((w) => w.id);
    if (walletIds.length === 0) {
      setKidsWallets([]);
      setRules({});
      setWalletsLoading(false);
      return;
    }

    // Allowance rules + materialize any deposit that is already due
    const rulesMap = await fetchAllowanceRules(walletIds);
    await Promise.all(Object.values(rulesMap).map((r) => syncAllowanceDeposits(r, effectiveUserId)));
    setRules(rulesMap);

    // Calcula saldo
    const endOfThisMonthStr = format(endOfMonth(new Date()), "yyyy-MM-dd");
    const { data: txData } = await supabase
      .from("transactions")
      .select("wallet_id, amount, type")
      .in("wallet_id", walletIds)
      .lte("payment_date", endOfThisMonthStr);

    const balanceMap: Record<string, number> = {};
    if (txData) {
      txData.forEach((tx) => {
        if (!balanceMap[tx.wallet_id]) balanceMap[tx.wallet_id] = 0;
        balanceMap[tx.wallet_id] +=
          tx.type === "receita" ? Number(tx.amount) : -Number(tx.amount);
      });
    }

    const enrichedWallets = walletsData.map((w) => ({
      ...w,
      balance: balanceMap[w.id] || 0,
    }));

    setKidsWallets(enrichedWallets);
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

    // Remove the allowance rule (if any) before the wallet itself
    await supabase.from("recurring_transactions").delete().eq("wallet_id", wallet.id).eq("notes", KIDS_ALLOWANCE_MARKER);

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
              {kidsWallets.map(wallet => {
                const rule = rules[wallet.id];
                const next = rule ? getNextAllowanceDate(rule) : null;
                return (
                  <Card
                    key={wallet.id}
                    id={`kid-card-${wallet.id}`}
                    className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg transition-all group relative overflow-hidden"
                    onClick={() => setSelectedWalletId(wallet.id)}
                  >
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
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
                    <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center relative">
                      <KidAvatar walletId={wallet.id} size={72} />
                      <div>
                        <h3 className="font-semibold text-lg">{getKidDisplayName(wallet)}</h3>
                        <p className="text-sm text-muted-foreground">Conta Corrente</p>
                        {wallet.balance !== undefined && (
                          <div className="mt-3">
                            <p className="text-xl font-bold text-primary">{formatBRL(wallet.balance)}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Disponível</p>
                          </div>
                        )}
                      </div>
                      {next ? (
                        <Badge variant="outline" className="gap-1 border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300">
                          <CalendarClock className="h-3 w-3" />
                          Mesada {relativeDayLabel(next)} · {formatBRL(rule!.amount)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground font-normal">Sem mesada automática</Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add Kid Card */}
              <Card
                id="add-kid-card"
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
          <Button variant="ghost" onClick={() => { setSelectedWalletId(null); fetchKidsWallets(); }} className="gap-2 -ml-4">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {selectedWallet && effectiveUserId && (
            <KidDashboard
              key={selectedWallet.id}
              wallet={selectedWallet}
              effectiveUserId={effectiveUserId}
              displayName={getKidDisplayName(selectedWallet)}
              onAvatarChange={() => setAvatarVersion((v) => v + 1)}
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
  onAvatarChange,
}: {
  wallet: KidsWallet;
  effectiveUserId: string;
  displayName: string;
  onAvatarChange: () => void;
}) {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [rule, setRule] = useState<AllowanceRule | null>(null);
  const [ruleLoading, setRuleLoading] = useState(true);
  const [goals, setGoals] = useState<KidGoal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"receita" | "despesa">("despesa");
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    isInstallment: false,
    installmentsCount: 2,
  });
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

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

  // Load rule → materialize due deposits → load transactions
  useEffect(() => {
    let active = true;
    (async () => {
      setRuleLoading(true);
      const map = await fetchAllowanceRules([wallet.id]);
      const r = map[wallet.id] ?? null;
      if (r) await syncAllowanceDeposits(r, effectiveUserId);
      if (!active) return;
      setRule(r);
      setRuleLoading(false);
      fetchKidsTransactions();
      setGoals(await fetchKidGoals(wallet.id));
    })();
    return () => { active = false; };
  }, [wallet.id, effectiveUserId, fetchKidsTransactions]);

  const endOfThisMonthStr = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const endOfYearStr = format(endOfYear(new Date()), "yyyy-MM-dd");
  const pastAndCurrentTransactions = transactions.filter(tx => tx.payment_date && tx.payment_date <= endOfThisMonthStr);
  const futureTransactions = transactions.filter(tx => tx.payment_date && tx.payment_date > endOfThisMonthStr);

  const balance = pastAndCurrentTransactions.reduce((acc, curr) => {
    return curr.type === "receita" ? acc + Number(curr.amount) : acc - Number(curr.amount);
  }, 0);

  // Upcoming allowance deposits (virtual, not yet materialized)
  const upcomingAllowances = rule ? getUpcomingAllowances(rule) : [];
  const nextAllowance = rule ? getNextAllowanceDate(rule) : null;

  // Projection until Dec 31: balance + future entries this year + scheduled allowances
  const projectedBalance =
    balance +
    futureTransactions
      .filter((tx) => tx.payment_date <= endOfYearStr)
      .reduce((acc, tx) => acc + (tx.type === "receita" ? Number(tx.amount) : -Number(tx.amount)), 0) +
    upcomingAllowances.length * (rule?.amount ?? 0);

  const parseInstallment = (desc: string) => {
    const match = desc.match(/(.+?)\s+\((\d+)\/(\d+)\)$/);
    if (match) {
      return { baseName: match[1].trim(), current: parseInt(match[2]), total: parseInt(match[3]) };
    }
    return null;
  };

  const renderSingleTx = (tx: Tx, txIsFuture: boolean, hideBorder: boolean = false) => (
    <div key={tx.id} className={`group flex items-center justify-between p-3 ${hideBorder ? '' : 'border rounded-lg'} transition-colors ${txIsFuture && !hideBorder ? 'bg-muted/30 border-dashed border-muted-foreground/30 opacity-80' : 'bg-card hover:bg-muted/50'}`}>
      <div className="flex items-center gap-3">
        {tx.type === "receita" ? (
          <div className={`p-2 rounded-full ${txIsFuture ? 'bg-green-100/50 dark:bg-green-900/10' : 'bg-green-100 dark:bg-green-900/30'}`}>
            <ArrowUpCircle className={`h-5 w-5 ${txIsFuture ? 'text-green-600/60 dark:text-green-400/60' : 'text-green-600 dark:text-green-400'}`} />
          </div>
        ) : (
          <div className={`p-2 rounded-full ${txIsFuture ? 'bg-red-100/50 dark:bg-red-900/10' : 'bg-red-100 dark:bg-red-900/30'}`}>
            <ArrowDownCircle className={`h-5 w-5 ${txIsFuture ? 'text-red-600/60 dark:text-red-400/60' : 'text-red-600 dark:text-red-400'}`} />
          </div>
        )}
        <div>
          <p className={`font-medium text-sm flex items-center gap-2 ${txIsFuture ? 'text-muted-foreground' : ''}`}>
            {tx.description}
            {tx.notes === KIDS_ALLOWANCE_MARKER && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400/40 text-amber-600 dark:text-amber-400 gap-1"><Repeat className="h-2.5 w-2.5" />Automática</Badge>}
            {txIsFuture && !hideBorder && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30">Previsto</Badge>}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <CalendarIcon className="h-3 w-3" />
            {tx.payment_date ? new Date(tx.payment_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
            {tx.category && <span className="ml-1 px-2 py-0.5 bg-muted rounded-full text-[10px]">{tx.category}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className={`font-semibold ${tx.type === "receita" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} ${txIsFuture ? 'opacity-80' : ''}`}>
          {tx.type === "receita" ? "+" : "-"} {formatBRL(Number(tx.amount))}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openModal(tx.type as "receita" | "despesa", tx)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTransaction(tx.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  /** Scheduled allowance shown like an installment group */
  const renderAllowanceGroup = () => {
    if (!rule || upcomingAllowances.length === 0) return null;
    const visible = upcomingAllowances.slice(0, 12);
    return (
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="mesada" className="border border-amber-400/30 rounded-lg bg-amber-400/5 px-1 overflow-hidden">
          <AccordionTrigger className="hover:no-underline px-3 py-3 data-[state=open]:border-b">
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold text-sm">Mesada programada</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400/40 text-amber-700 dark:text-amber-300">
                    {upcomingAllowances.length}x até 31/12
                  </Badge>
                </div>
                {nextAllowance && (
                  <span className="text-[11px] text-muted-foreground">
                    Próxima: <span className="capitalize">{formatShortDate(nextAllowance)}</span> ({relativeDayLabel(nextAllowance)})
                  </span>
                )}
              </div>
              <div className="font-semibold text-green-600/80">+ {formatBRL(upcomingAllowances.length * rule.amount)}</div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-2 px-2">
            <div className="space-y-1">
              {visible.map((d, i) => (
                <div key={d.toISOString()} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "bg-amber-400/30"}`} />
                    <span className="text-sm capitalize">{formatShortDate(d)}</span>
                    {i === 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{relativeDayLabel(d)}</Badge>}
                  </div>
                  <span className="text-sm font-medium text-green-600/80">+ {formatBRL(rule.amount)}</span>
                </div>
              ))}
              {upcomingAllowances.length > visible.length && (
                <p className="text-xs text-muted-foreground text-center pt-1">+ {upcomingAllowances.length - visible.length} depósitos até o fim do ano</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderTransactionList = (txList: Tx[], isProjected: boolean = false) => {
    if (loading) return <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>;
    if (txList.length === 0 && !(isProjected && upcomingAllowances.length > 0)) {
      return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada.</p>;
    }

    if (!isProjected) {
      return txList.map((tx) => {
        const txIsFuture = tx.payment_date ? tx.payment_date > endOfThisMonthStr : false;
        return renderSingleTx(tx, txIsFuture);
      });
    }

    const grouped: Record<string, Tx[]> = {};
    const singles: Tx[] = [];

    txList.forEach(tx => {
      const parsed = parseInstallment(tx.description || "");
      if (parsed) {
        if (!grouped[parsed.baseName]) grouped[parsed.baseName] = [];
        grouped[parsed.baseName].push(tx);
      } else {
        singles.push(tx);
      }
    });

    return (
      <div className="space-y-4">
        {renderAllowanceGroup()}
        {singles.map(tx => renderSingleTx(tx, true))}

        {Object.keys(grouped).length > 0 && (
          <Accordion type="multiple" className="w-full space-y-4">
            {Object.entries(grouped).map(([baseName, groupTxs]) => {
              const parsedFirst = parseInstallment(groupTxs[0].description || "");
              const totalInstallments = parsedFirst?.total || 1;
              const remainingInstallments = groupTxs.length;
              const completedInstallments = totalInstallments - remainingInstallments;
              const progressPercentage = (completedInstallments / totalInstallments) * 100;
              const totalGroupAmount = groupTxs.reduce((acc, tx) => acc + Number(tx.amount), 0);
              const isReceita = groupTxs[0].type === "receita";

              return (
                <AccordionItem key={baseName} value={baseName} className="border rounded-lg bg-muted/10 px-1 overflow-hidden">
                  <AccordionTrigger className="hover:no-underline px-3 py-3 data-[state=open]:border-b">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-400/80" />
                          <span className="font-semibold text-sm">{baseName}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30">
                            Parcelado
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 w-full mt-1">
                          <Progress value={progressPercentage} className="h-1.5 w-24" />
                          <span className="text-[10px] text-muted-foreground">
                            {completedInstallments}/{totalInstallments} pagas
                          </span>
                        </div>
                      </div>
                      <div className={`font-semibold ${isReceita ? "text-green-600/80" : "text-red-600/80"}`}>
                        {isReceita ? "+" : "-"} {formatBRL(totalGroupAmount)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-0 px-2">
                    <div className="space-y-1">
                      {groupTxs.map(tx => renderSingleTx(tx, true, true))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    );
  };

  const openModal = (type: "receita" | "despesa", txToEdit?: Tx) => {
    setModalType(type);
    if (txToEdit) {
      setEditingTxId(txToEdit.id);
      setFormData({
        title: txToEdit.description || "",
        amount: txToEdit.amount.toString(),
        date: txToEdit.payment_date || format(new Date(), "yyyy-MM-dd"),
        category: txToEdit.category || "",
        isInstallment: false,
        installmentsCount: 2,
      });
    } else {
      setEditingTxId(null);
      setFormData({
        title: "",
        amount: "",
        date: format(new Date(), "yyyy-MM-dd"),
        category: "",
        isInstallment: false,
        installmentsCount: 2,
      });
    }
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

    if (editingTxId) {
      const { error } = await supabase.from("transactions").update({
        type: modalType,
        description: formData.title,
        amount: amountVal,
        payment_date: formData.date,
        competence_date: formData.date,
        category: formData.category || "Geral",
      }).eq("id", editingTxId);

      if (error) {
        toast.error("Erro ao atualizar lançamento.");
        console.error(error);
        return;
      }
      toast.success("Lançamento atualizado!");
    } else {
      if (modalType === "despesa" && formData.isInstallment && formData.installmentsCount > 1) {
        const numInstallments = formData.installmentsCount;
        const installmentAmount = amountVal / numInstallments;
        const startDate = new Date(formData.date + "T12:00:00");

        const payloads: TablesInsert<"transactions">[] = [];
        for (let i = 0; i < numInstallments; i++) {
          const installmentDate = new Date(startDate);
          installmentDate.setMonth(installmentDate.getMonth() + i);

          payloads.push({
            user_id: effectiveUserId,
            type: modalType,
            description: `${formData.title} (${i + 1}/${numInstallments})`,
            amount: installmentAmount,
            payment_date: format(installmentDate, "yyyy-MM-dd"),
            competence_date: formData.date,
            category: formData.category || "Geral",
            status: i === 0 && startDate <= new Date() ? "Pago" : "Pendente",
            wallet_id: wallet.id,
          });
        }

        const { error } = await supabase.from("transactions").insert(payloads);
        if (error) {
          toast.error("Erro ao salvar lançamentos parcelados.");
          console.error(error);
          return;
        }
        toast.success("Gasto parcelado registrado!");
      } else {
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
        toast.success(modalType === "receita" ? "Receita registrada!" : "Gasto registrado!");
      }
    }

    setIsModalOpen(false);
    fetchKidsTransactions();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir lançamento.");
      console.error(error);
      return;
    }
    toast.success("Lançamento excluído!");
    fetchKidsTransactions();
  };

  const handleDeleteGoal = async (goal: KidGoal) => {
    if (!confirm(`Remover a constelação "${goal.name}"?`)) return;
    try {
      await deleteKidGoal(goal.id);
      setGoals((g) => g.filter((x) => x.id !== goal.id));
      toast.success("Constelação removida.");
    } catch {
      toast.error("Erro ao remover constelação.");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Balance */}
      <Card className="md:col-span-2 border-primary/20 shadow-premium glow-primary-sm bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none mix-blend-screen" />
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Moon className="w-32 h-32 text-indigo-300" />
        </div>
        <CardHeader className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <KidAvatar walletId={wallet.id} size={52} editable displayName={displayName} onChange={onAvatarChange} />
              <div>
                <CardTitle className="text-indigo-100 flex items-center gap-2">
                  Conta de {displayName}
                </CardTitle>
                <CardDescription className="text-indigo-200/70">Saldo disponível na conta corrente</CardDescription>
              </div>
            </div>
            <Button
              id="open-kid-universe-btn"
              size="sm"
              onClick={() => navigate(`/kids/space/${wallet.id}`)}
              className="gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm shrink-0"
            >
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Universo de {displayName}</span>
              <span className="sm:hidden">Modo Criança</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-4xl font-bold font-display text-white transition-all duration-300 drop-shadow-lg">
            {loading ? "Calculando..." : formatBRL(balance)}
          </div>
          <div className="text-sm text-indigo-200/80 mt-1 font-medium">
            {loading ? "..." : `Previsto até 31/12: ${formatBRL(projectedBalance)}`}
          </div>

          {nextAllowance && rule && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100">
              <CalendarClock className="h-3.5 w-3.5 text-amber-300" />
              Próxima mesada: <strong>+{formatBRL(rule.amount)}</strong>
              <span className="capitalize">{formatShortDate(nextAllowance)}</span>
              <span className="text-amber-200/70">({relativeDayLabel(nextAllowance)})</span>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 relative z-10">
            <Button
              id="kid-add-income-btn"
              onClick={() => openModal("receita")}
              className="h-auto py-3 flex-col gap-0.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold border-none shadow-[0_8px_24px_-8px_rgba(16,185,129,0.7)]"
              disabled={loading}
            >
              <span className="flex items-center gap-2"><ArrowUpCircle className="h-4 w-4" /> Adicionar Receita</span>
              <span className="text-[11px] font-normal text-emerald-50/80">entrada de dinheiro</span>
            </Button>
            <Button
              id="kid-add-expense-btn"
              onClick={() => openModal("despesa")}
              variant="outline"
              className="h-auto py-3 flex-col gap-0.5 text-rose-100 hover:bg-rose-500/20 hover:text-white border-rose-300/40 bg-rose-500/10 backdrop-blur-sm font-semibold"
              disabled={loading}
            >
              <span className="flex items-center gap-2"><ArrowDownCircle className="h-4 w-4" /> Registrar Gasto</span>
              <span className="text-[11px] font-normal text-rose-100/70">saída de dinheiro</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Allowance Settings */}
      <AllowanceRuleCard
        walletId={wallet.id}
        userId={effectiveUserId}
        displayName={displayName}
        rule={rule}
        loading={ruleLoading}
        onChange={async (r) => {
          setRule(r);
          if (r) {
            await syncAllowanceDeposits(r, effectiveUserId);
            fetchKidsTransactions();
          }
        }}
      />

      {/* Kid constellations (goals created in the kid universe) */}
      {goals.length > 0 && (
        <Card className="md:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Metas de {displayName}
            </CardTitle>
            <CardDescription>Criadas por {displayName} no Universo (Modo Criança)</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {goals.map((g) => {
              const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
              return (
                <div key={g.id} className="group rounded-lg border p-3 flex items-center gap-3">
                  <span className="text-2xl">{g.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    <Progress value={pct} className="h-1.5 mt-1" />
                    <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(g.current_amount)} de {formatBRL(g.target_amount)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteGoal(g)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card className="md:col-span-3">
        <Tabs defaultValue="realizado" className="w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Histórico
            </CardTitle>
            <TabsList className="h-9">
              <TabsTrigger value="realizado" className="text-xs">Realizado</TabsTrigger>
              <TabsTrigger value="projetado" className="text-xs">
                A vencer
                {(futureTransactions.length > 0 || upcomingAllowances.length > 0) && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </TabsTrigger>
              <TabsTrigger value="todos" className="text-xs">Tudo</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-6">
            <TabsContent value="realizado" className="space-y-4 mt-0">
              {renderTransactionList(pastAndCurrentTransactions, false)}
            </TabsContent>
            <TabsContent value="projetado" className="space-y-4 mt-0">
              {renderTransactionList(futureTransactions, true)}
            </TabsContent>
            <TabsContent value="todos" className="space-y-4 mt-0">
              {renderTransactionList(transactions, false)}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Transaction Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalType === "receita" ? (
                <><ArrowUpCircle className="h-5 w-5 text-emerald-500" /> {editingTxId ? "Editar Receita" : "Nova Receita"}</>
              ) : (
                <><ArrowDownCircle className="h-5 w-5 text-rose-500" /> {editingTxId ? "Editar Gasto" : "Novo Gasto"}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {modalType === "receita"
                ? `Dinheiro que ENTRA na conta de ${displayName} (presente, mesada extra, recompensa...).`
                : `Dinheiro que SAI da conta de ${displayName} (lanche, brinquedo, passeio...).`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Descrição</Label>
              <Input
                id="title"
                placeholder={modalType === "receita" ? "Ex: Presente da Vó, Mesada extra" : "Ex: Lanche, Brinquedo"}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">{modalType === "despesa" && formData.isInstallment ? "Valor Total (R$)" : "Valor (R$)"}</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0,00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">{modalType === "despesa" && formData.isInstallment ? "Data 1ª Parcela" : "Data"}</Label>
                <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
            </div>

            {modalType === "despesa" && !editingTxId && (
              <div className="space-y-4 border p-3 rounded-md bg-muted/10 mt-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is-installment"
                    checked={formData.isInstallment}
                    onCheckedChange={(checked) => setFormData({ ...formData, isInstallment: checked })}
                  />
                  <Label htmlFor="is-installment" className="cursor-pointer font-medium">Compra Parcelada?</Label>
                </div>

                {formData.isInstallment && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="installmentsCount">Número de Parcelas</Label>
                    <Input
                      id="installmentsCount"
                      type="number"
                      min="2"
                      max="48"
                      value={formData.installmentsCount}
                      onChange={(e) => setFormData({ ...formData, installmentsCount: parseInt(e.target.value) || 2 })}
                    />
                    {formData.amount && formData.installmentsCount > 1 && (
                      <p className="text-sm text-muted-foreground mt-2 bg-muted/30 p-2 rounded border border-muted">
                        Serão geradas <strong className="text-foreground">{formData.installmentsCount}</strong> parcelas de <strong className="text-foreground">{formatBRL(parseFloat(formData.amount.replace(",", ".")) / formData.installmentsCount)}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" placeholder="Ex: Presente, Alimentação, Lazer" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveTransaction}
              className={modalType === "receita" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}
            >
              {modalType === "receita" ? "Salvar Receita" : "Salvar Gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
