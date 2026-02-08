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
import { CreditCard, Plus, Pencil, Trash2, Landmark, Wallet } from "lucide-react";
import { useAccounts, type BankAccount, type CreditCard as CreditCardType, type Wallet as WalletType } from "@/hooks/useAccounts";
import { useCompany } from "@/contexts/CompanyContext";
import { AccountFormModal } from "@/components/contas/AccountFormModal";
import { Skeleton } from "@/components/ui/skeleton";

type AccountTab = "bank" | "card" | "wallet";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Contas() {
  const { isPersonal } = useCompany();
  const {
    bankAccounts, creditCards, wallets, loading,
    createBankAccount, updateBankAccount, deleteBankAccount,
    createCreditCard, updateCreditCard, deleteCreditCard,
    createWallet, updateWallet, deleteWallet,
  } = useAccounts();

  const [activeTab, setActiveTab] = useState<AccountTab>("bank");
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; tab: AccountTab } | null>(null);

  const openCreate = () => { setEditData(null); setFormOpen(true); };
  const openEdit = (data: any) => { setEditData(data); setFormOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.tab === "bank") await deleteBankAccount(deleteTarget.id);
    else if (deleteTarget.tab === "card") await deleteCreditCard(deleteTarget.id);
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

  const btnLabel: Record<AccountTab, string> = {
    bank: "Nova Conta",
    card: "Novo Cartão",
    wallet: "Nova Carteira",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas & Cartões</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie contas bancárias, cartões e carteiras — {isPersonal ? "Pessoal" : "Empresa"}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {btnLabel[activeTab]}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AccountTab)}>
        <TabsList>
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
                    {creditCards.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.last_four_digits ? `**** ${c.last_four_digits}` : "—"}</TableCell>
                        <TableCell>Dia {c.closing_day}</TableCell>
                        <TableCell>Dia {c.due_day}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(c.limit)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: c.id, name: c.name, tab: "card" })} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
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

        {/* Wallets */}
        <TabsContent value="wallet">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : wallets.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <Wallet className="h-8 w-8 opacity-50" />
                  Nenhuma carteira cadastrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Saldo Inicial</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallets.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(w.initial_balance)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(w)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: w.id, name: w.name, tab: "wallet" })} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
      </Tabs>

      {/* Form Modal */}
      <AccountFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        tab={activeTab}
        editData={editData}
        bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: a.name }))}
        onSaveBankAccount={handleSaveBankAccount}
        onSaveCreditCard={handleSaveCreditCard}
        onSaveWallet={handleSaveWallet}
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
    </div>
  );
}
