import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditCard, Plus, Pencil, Trash2, Landmark, Wallet, Smartphone, Receipt, FileText, Link } from "lucide-react";
import { VirtualWalletCard } from "@/components/contas/VirtualWalletCard";
import { useAccounts, type CardTerminal } from "@/hooks/useAccounts";
import { useCompany } from "@/contexts/CompanyContext";
import { AccountFormModal } from "@/components/contas/AccountFormModal";
import { CreditCardFormModal } from "@/components/contas/CreditCardFormModal";
import { TerminalFormModal } from "@/components/contas/TerminalFormModal";
import { CreditCardBillPaymentModal } from "@/components/contas/CreditCardBillPaymentModal";
import { AccountStatementModal } from "@/components/contas/AccountStatementModal";
import { Skeleton } from "@/components/ui/skeleton";

type AccountTab = "bank" | "card" | "wallet" | "terminal";

// Track flipped state per wallet
const useWalletFlips = () => {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setFlipped(prev => ({ ...prev, [id]: !prev[id] }));
  return { flipped, toggle };
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Contas() {
  const { isPersonal } = useCompany();
  const {
    bankAccounts, creditCards, wallets, cardTerminals, loading,
    createBankAccount, updateBankAccount, deleteBankAccount,
    createCreditCard, updateCreditCard, deleteCreditCard,
    createWallet, updateWallet, deleteWallet,
    createCardTerminal, updateCardTerminal, deleteCardTerminal,
  } = useAccounts();

  const [activeTab, setActiveTab] = useState<AccountTab>("bank");
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [terminalFormOpen, setTerminalFormOpen] = useState(false);
  const [terminalEditData, setTerminalEditData] = useState<CardTerminal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; tab: AccountTab } | null>(null);
  const [billPaymentCard, setBillPaymentCard] = useState<any>(null);
  const [statementTarget, setStatementTarget] = useState<{
    id: string; type: "bank" | "wallet" | "card"; name: string; initialBalance?: number;
  } | null>(null);
  const walletFlips = useWalletFlips();

  const openCreate = () => {
    if (activeTab === "terminal") {
      setTerminalEditData(null);
      setTerminalFormOpen(true);
    } else {
      setEditData(null);
      setFormOpen(true);
    }
  };

  const openEdit = (data: any) => {
    if (activeTab === "terminal") {
      setTerminalEditData(data);
      setTerminalFormOpen(true);
    } else {
      setEditData(data);
      setFormOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.tab === "bank") await deleteBankAccount(deleteTarget.id);
    else if (deleteTarget.tab === "card") await deleteCreditCard(deleteTarget.id);
    else if (deleteTarget.tab === "terminal") await deleteCardTerminal(deleteTarget.id);
    else await deleteWallet(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleSaveBankAccount = async (data: any) => {
    if (editData) return updateBankAccount(editData.id, data);
    return createBankAccount(data);
  };

  const handleSaveCreditCard = async (data: any) => {
    if (editData) return updateCreditCard(editData.id, data);
    return createCreditCard(data);
  };

  const handleSaveWallet = async (data: any) => {
    if (editData) return updateWallet(editData.id, data);
    return createWallet(data);
  };

  const handleSaveTerminal = async (data: any) => {
    if (terminalEditData) return updateCardTerminal(terminalEditData.id, data);
    return createCardTerminal(data);
  };

  const btnLabel: Record<AccountTab, string> = {
    bank: "Nova Conta",
    card: "Novo Cartão",
    wallet: "Nova Carteira",
    terminal: "Nova Maquininha",
  };

  const parseRatesInfo = (ri: string | null): { installments: number; rate: number }[] => {
    if (!ri) return [];
    try { return JSON.parse(ri); } catch { return []; }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Contas & Cartões</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie contas bancárias, cartões, carteiras e maquininhas — {isPersonal ? "Pessoal" : "Empresa"}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {btnLabel[activeTab]}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AccountTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="bank" className="gap-2">
            <Landmark className="h-4 w-4" />
            Contas Bancárias
            <Badge variant="secondary" className="ml-1 text-xs">{bankAccounts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="card" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Cartões
            <Badge variant="secondary" className="ml-1 text-xs">{creditCards.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="wallet" className="gap-2">
            <Wallet className="h-4 w-4" />
            Carteiras
            <Badge variant="secondary" className="ml-1 text-xs">{wallets.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="terminal" className="gap-2">
            <Smartphone className="h-4 w-4" />
            Maquininhas
            <Badge variant="secondary" className="ml-1 text-xs">{cardTerminals.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Bank Accounts */}
        <TabsContent value="bank">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : bankAccounts.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <Landmark className="h-8 w-8 opacity-50" />
                  Nenhuma conta bancária cadastrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Agência</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right">Saldo Inicial</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankAccounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell><Badge variant="outline">{a.type}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{a.agency_number || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{a.account_number || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(a.initial_balance)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setStatementTarget({ id: a.id, type: "bank", name: a.name, initialBalance: a.initial_balance })} className="h-8 w-8" title="Extrato"><FileText className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(a)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: a.id, name: a.name, tab: "bank" })} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credit Cards */}
        <TabsContent value="card">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : creditCards.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <CreditCard className="h-8 w-8 opacity-50" />
                  Nenhum cartão cadastrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Últimos 4</TableHead>
                      <TableHead>Fechamento</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Limite</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Sort: main cards first, then linked cards grouped under parent */}
                    {(() => {
                      const mainCards = creditCards.filter((c) => !(c as any).parent_card_id);
                      const childCards = creditCards.filter((c) => (c as any).parent_card_id);
                      const sorted: typeof creditCards = [];
                      mainCards.forEach((main) => {
                        sorted.push(main);
                        childCards.filter((ch) => (ch as any).parent_card_id === main.id).forEach((ch) => sorted.push(ch));
                      });
                      // orphan children (parent deleted)
                      childCards.filter((ch) => !mainCards.find((m) => m.id === (ch as any).parent_card_id)).forEach((ch) => sorted.push(ch));
                      return sorted;
                    })().map((c) => {
                      const isChild = !!(c as any).parent_card_id;
                      const parentName = isChild ? creditCards.find((p) => p.id === (c as any).parent_card_id)?.name : undefined;
                      return (
                        <TableRow key={c.id} className={isChild ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {isChild && <Link className="h-3.5 w-3.5 text-muted-foreground ml-4" />}
                              <span>{c.name}</span>
                              {isChild && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Virtual
                                </Badge>
                              )}
                            </div>
                            {isChild && parentName && (
                              <span className="text-[10px] text-muted-foreground ml-10">
                                vinculado a {parentName}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.last_four_digits ? `**** ${c.last_four_digits}` : "—"}</TableCell>
                          <TableCell>Dia {c.closing_day}</TableCell>
                          <TableCell>Dia {c.due_day}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(c.limit)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setStatementTarget({ id: c.id, type: "card", name: c.name })} className="h-8 w-8" title="Extrato"><FileText className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setBillPaymentCard(c)} className="h-8 gap-1 text-xs"><Receipt className="h-3.5 w-3.5" />Pagar Fatura</Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: c.id, name: c.name, tab: "card" })} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallets - Virtual Card Layout */}
        <TabsContent value="wallet">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[260px] w-full rounded-lg" />)}
            </div>
          ) : wallets.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <Wallet className="h-8 w-8 opacity-50" />
                  Nenhuma carteira cadastrada
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {wallets.map((w) => (
                <div key={w.id} className="flex flex-col items-center gap-3">
                  <VirtualWalletCard
                    isFlipped={!!walletFlips.flipped[w.id]}
                    onFlip={() => walletFlips.toggle(w.id)}
                    walletName={w.name}
                    balance={String(w.initial_balance)}
                  />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setStatementTarget({ id: w.id, type: "wallet", name: w.name, initialBalance: w.initial_balance })} className="h-8 w-8" title="Extrato"><FileText className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(w)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: w.id, name: w.name, tab: "wallet" })} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Card Terminals */}
        <TabsContent value="terminal">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : cardTerminals.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <Smartphone className="h-8 w-8 opacity-50" />
                  Nenhuma maquininha cadastrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Adquirente</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Taxas</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cardTerminals.map((term) => {
                      const accountName = bankAccounts.find((a) => a.id === term.bank_account_id)?.name || "—";
                      const rates = parseRatesInfo(term.rates_info);
                      return (
                        <TableRow key={term.id}>
                          <TableCell className="font-medium">{term.name}</TableCell>
                          <TableCell className="text-muted-foreground">{term.acquirer || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{accountName}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {term.debit_rate != null && (
                                <Badge variant="outline" className="text-[10px]">
                                  DÉB: {term.debit_rate}% D+{term.settlement_days_debit ?? "?"}
                                </Badge>
                              )}
                              {term.credit_rate != null && (
                                <Badge variant="outline" className="text-[10px]">
                                  CRÉD: {term.credit_rate}% D+{term.settlement_days_credit ?? "?"}
                                </Badge>
                              )}
                              {rates.length > 0 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  +{rates.length} plano{rates.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(term)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: term.id, name: term.name, tab: "terminal" })} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Account Form Modal (bank, wallet) */}
      <AccountFormModal
        open={formOpen && activeTab !== "card"}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        tab={activeTab === "terminal" ? "bank" : activeTab}
        editData={editData}
        bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: a.name }))}
        onSaveBankAccount={handleSaveBankAccount}
        onSaveCreditCard={handleSaveCreditCard}
        onSaveWallet={handleSaveWallet}
      />

      {/* Credit Card 3D Form Modal */}
      <CreditCardFormModal
        open={formOpen && activeTab === "card"}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        editData={editData}
        bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: a.name }))}
        onSave={handleSaveCreditCard}
      />

      {/* Terminal Form Modal */}
      <TerminalFormModal
        open={terminalFormOpen}
        onClose={() => { setTerminalFormOpen(false); setTerminalEditData(null); }}
        editData={terminalEditData}
        bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: a.name }))}
        onSave={handleSaveTerminal}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Lançamentos vinculados podem ser afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Credit Card Bill Payment */}
      <CreditCardBillPaymentModal
        open={!!billPaymentCard}
        creditCard={billPaymentCard}
        onClose={() => setBillPaymentCard(null)}
        onSuccess={() => setBillPaymentCard(null)}
      />

      {/* Account Statement */}
      {statementTarget && (
        <AccountStatementModal
          open={!!statementTarget}
          onClose={() => setStatementTarget(null)}
          accountId={statementTarget.id}
          accountType={statementTarget.type}
          accountName={statementTarget.name}
          initialBalance={statementTarget.initialBalance}
        />
      )}
    </div>
  );
}
