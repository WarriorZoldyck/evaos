import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useFormFieldSettings } from "@/hooks/useFormFieldSettings";
import { Plus, User, Building2, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/contexts/CompanyContext";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { TransactionFilters } from "@/components/lancamentos/TransactionFilters";
import { TransactionTable } from "@/components/lancamentos/TransactionTable";
import { TransactionFormModal } from "@/components/lancamentos/TransactionFormModal";
import { TransactionDetailModal } from "@/components/lancamentos/TransactionDetailModal";
import { SeriesEditDialog } from "@/components/lancamentos/SeriesEditDialog";
import { LiquidateModal } from "@/components/dashboard/LiquidateModal";
import { CreditCardBillPaymentModal } from "@/components/contas/CreditCardBillPaymentModal";

type TabValue = "todos" | "realizado" | "projetado";

export default function Lancamentos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isPersonal, companies, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { settings: fieldSettings } = useFormFieldSettings();
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const contextLabel = isPersonal ? "Pessoal" : selectedCompany?.name ?? "Pessoal";

  const {
    transactions, loading, totalCount, page, setPage, totalPages,
    filters, setFilters,
    createTransaction, createMultipleTransactions, updateTransaction,
    deleteTransaction, deleteSeriesTransactions, duplicateTransaction,
    fetchTransactions,
    bankAccounts, creditCards, wallets, suppliers, clients, categories,
    cardTerminals, allAccounts,
  } = useTransactions();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false);
  const [seriesDialogMode, setSeriesDialogMode] = useState<"edit" | "delete">("delete");
  const [seriesTarget, setSeriesTarget] = useState<Transaction | null>(null);
  const [liquidateTarget, setLiquidateTarget] = useState<Transaction | null>(null);
  const [detailTarget, setDetailTarget] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("todos");
  const [billPaymentCard, setBillPaymentCard] = useState<any>(null);

  // Read query params from dashboard category chart clicks
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    const typeParam = searchParams.get("type");
    if (categoryParam || typeParam) {
      // Find category by name to get its ID
      const matchedCat = categories.find(
        (c) => c.name === categoryParam && !c.parent_id
      );
      setFilters((prev) => ({
        ...prev,
        categoryId: matchedCat?.id || "",
        type: (typeParam as "receita" | "despesa") || "todos",
      }));
      if (typeParam === "receita" || typeParam === "despesa") {
        setActiveTab(typeParam === "receita" ? "realizado" : "realizado");
      }
      // Clear params after applying
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, categories]);

  const handleTabChange = (value: string) => {
    const tab = value as TabValue;
    setActiveTab(tab);
    if (tab === "realizado") setFilters({ ...filters, status: "Pago" });
    else if (tab === "projetado") setFilters({ ...filters, status: "Pendente" });
    else setFilters({ ...filters, status: "todos" });
  };

  const handleEdit = (t: Transaction) => {
    if (t.series_id) {
      setSeriesTarget(t);
      setSeriesDialogMode("edit");
      setSeriesDialogOpen(true);
    } else {
      setEditingTransaction(t);
      setFormOpen(true);
    }
  };

  const handleDelete = (t: Transaction) => {
    if (t.series_id) {
      setSeriesTarget(t);
      setSeriesDialogMode("delete");
      setSeriesDialogOpen(true);
    } else {
      setDeleteTarget(t);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteTransaction(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleSeriesConfirm = async (scope: "only" | "from" | "all") => {
    if (!seriesTarget) return;
    setSeriesDialogOpen(false);

    if (seriesDialogMode === "delete") {
      if (scope === "only") {
        await deleteTransaction(seriesTarget.id);
      } else {
        await deleteSeriesTransactions(
          seriesTarget.series_id!,
          scope,
          seriesTarget.installment_number ?? undefined
        );
      }
    } else {
      setEditingTransaction(seriesTarget);
      setFormOpen(true);
    }
    setSeriesTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Lançamentos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {totalCount} lançamento{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg bg-accent/80 px-3 py-2 text-sm hover:bg-accent transition-all duration-200 border border-border hover:border-primary/20">
                {isPersonal ? (
                  <User className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="truncate font-medium">{contextLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => setSelectedCompanyId(null)}>
                <User className="mr-2 h-4 w-4" />
                Pessoal
              </DropdownMenuItem>
              {companies.length > 0 && <DropdownMenuSeparator />}
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => setSelectedCompanyId(company.id)}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {company.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          onClick={() => {
            setEditingTransaction(null);
            setFormOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      {/* Filters */}
      <TransactionFilters
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
      />

      {/* Tabs + Table */}
      <Card>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="border-b border-border px-4 pt-3">
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="realizado">Realizado</TabsTrigger>
              <TabsTrigger value="projetado">Projetado</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
        <CardContent className="pt-4">
           <TransactionTable
            transactions={transactions}
            loading={loading}
            categories={categories}
            bankAccounts={bankAccounts}
            wallets={wallets}
            creditCards={creditCards}
            suppliers={suppliers}
            clients={clients}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
            onEdit={handleEdit}
            onDuplicate={duplicateTransaction}
            onDelete={handleDelete}
            onLiquidate={(t) => {
              // If it's a credit card transaction, open bill payment flow
              if (t.credit_card_id) {
                const card = creditCards.find((c) => c.id === t.credit_card_id);
                if (card) {
                  setBillPaymentCard(card);
                  return;
                }
              }
              setLiquidateTarget(t);
            }}
            onViewDetails={(t) => setDetailTarget(t)}
          />
        </CardContent>
      </Card>

      {/* Form Modal */}
      <TransactionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTransaction(null);
        }}
        editTransaction={editingTransaction}
        onSave={createTransaction}
        onSaveMultiple={createMultipleTransactions}
        onUpdate={updateTransaction}
        bankAccounts={bankAccounts}
        creditCards={creditCards}
        wallets={wallets}
        suppliers={suppliers}
        clients={clients}
        categories={categories}
        cardTerminals={cardTerminals}
        allAccounts={allAccounts}
        companies={companies}
        fieldSettings={fieldSettings}
      />

      {/* Detail Modal */}
      <TransactionDetailModal
        transaction={detailTarget}
        onClose={() => setDetailTarget(null)}
        categories={categories}
        bankAccounts={bankAccounts}
        wallets={wallets}
        creditCards={creditCards}
        cardTerminals={cardTerminals}
        suppliers={suppliers}
        clients={clients}
        onEdit={handleEdit}
        onDuplicate={duplicateTransaction}
        onLiquidate={(t) => {
          setDetailTarget(null);
          if (t.credit_card_id) {
            const card = creditCards.find((c) => c.id === t.credit_card_id);
            if (card) { setBillPaymentCard(card); return; }
          }
          setLiquidateTarget(t);
        }}
        onDelete={handleDelete}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.description}
              &quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Series dialog */}
      <SeriesEditDialog
        open={seriesDialogOpen}
        onClose={() => {
          setSeriesDialogOpen(false);
          setSeriesTarget(null);
        }}
        mode={seriesDialogMode}
        onConfirm={handleSeriesConfirm}
      />

      {/* Liquidate modal */}
      <LiquidateModal
        transaction={
          liquidateTarget
            ? {
                id: liquidateTarget.id,
                description: liquidateTarget.description,
                amount: liquidateTarget.amount,
                type: liquidateTarget.type,
                payment_date: liquidateTarget.payment_date,
                bank_account_id: liquidateTarget.bank_account_id,
                series_id: liquidateTarget.series_id,
                credit_card_id: liquidateTarget.credit_card_id,
              }
            : null
        }
        onClose={() => setLiquidateTarget(null)}
        onSuccess={() => {
          setLiquidateTarget(null);
          fetchTransactions();
        }}
      />

      {/* Credit Card Bill Payment */}
      <CreditCardBillPaymentModal
        open={!!billPaymentCard}
        creditCard={billPaymentCard}
        onClose={() => setBillPaymentCard(null)}
        onSuccess={() => {
          setBillPaymentCard(null);
          fetchTransactions();
        }}
      />
    </div>
  );
}
