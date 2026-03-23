import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useFormFieldSettings } from "@/hooks/useFormFieldSettings";
import { Plus, CreditCard, Upload } from "lucide-react";
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
import { useCompany } from "@/contexts/CompanyContext";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { TransactionFilters } from "@/components/lancamentos/TransactionFilters";
import { TransactionTable } from "@/components/lancamentos/TransactionTable";
import { TransactionFormModal } from "@/components/lancamentos/TransactionFormModal";
import { TransactionDetailModal } from "@/components/lancamentos/TransactionDetailModal";
import { SeriesEditDialog } from "@/components/lancamentos/SeriesEditDialog";
import { LiquidateModal } from "@/components/dashboard/LiquidateModal";
import { CreditCardBillPaymentModal } from "@/components/contas/CreditCardBillPaymentModal";
import { ImportStatementModal } from "@/components/lancamentos/ImportStatementModal";

type TabValue = "todos" | "realizado" | "projetado";

export default function Lancamentos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { companies } = useCompany();
  const { settings: fieldSettings } = useFormFieldSettings();

  const {
    transactions, loading, totalCount, page, setPage, totalPages,
    filters, setFilters,
    createTransaction, createMultipleTransactions, updateTransaction,
    deleteTransaction, deleteSeriesTransactions, duplicateTransaction,
    fetchTransactions, updateMultipleTransactions,
    bankAccounts, creditCards, wallets, suppliers, clients, categories,
    cardTerminals, allCardTerminals, allAccounts, allCategories,
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
  const [importOpen, setImportOpen] = useState(false);

  // Open modal from query param (?new=true) or custom event
  useEffect(() => {
    const newParam = searchParams.get("new");
    if (newParam === "true") {
      setEditingTransaction(null);
      setFormOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = () => {
      setEditingTransaction(null);
      setFormOpen(true);
    };
    window.addEventListener("open-new-transaction", handler);
    return () => window.removeEventListener("open-new-transaction", handler);
  }, []);

  // Refresh when a transaction is created from the global modal
  useEffect(() => {
    const handler = () => fetchTransactions();
    window.addEventListener("transaction-created", handler);
    return () => window.removeEventListener("transaction-created", handler);
  }, [fetchTransactions]);

  // Read query params from dashboard clicks
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    const typeParam = searchParams.get("type");
    const statusParam = searchParams.get("status");
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");

    if (categoryParam || typeParam || statusParam || dateFromParam || dateToParam) {
      const matchedCat = categories.find(
        (c) => c.name === categoryParam && !c.parent_id
      );
      setFilters((prev) => ({
        ...prev,
        categoryId: matchedCat?.id || prev.categoryId,
        type: (typeParam as "receita" | "despesa") || prev.type,
        status: (statusParam as "Pago" | "Pendente") || prev.status,
        dateFrom: dateFromParam || prev.dateFrom,
        dateTo: dateToParam || prev.dateTo,
      }));
      if (statusParam === "Pago") setActiveTab("realizado");
      else if (statusParam === "Pendente") setActiveTab("projetado");
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
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Lançamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalCount} lançamento{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filters.accountId.startsWith("card:") && (() => {
            const cardId = filters.accountId.split(":").slice(1).join(":");
            const card = creditCards.find((c) => c.id === cardId);
            return card ? (
              <Button
                variant="outline"
                onClick={() => setBillPaymentCard(card)}
                className="gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Pagar Fatura
              </Button>
            ) : null;
          })()}
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Importar Extrato
          </Button>
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
      </div>

      {/* Filters */}
      <TransactionFilters
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
        bankAccounts={bankAccounts}
        wallets={wallets}
        creditCards={creditCards}
        suppliers={suppliers}
        clients={clients}
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
            allCategories={allCategories}
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
        onUpdateMultiple={updateMultipleTransactions}
        bankAccounts={bankAccounts}
        creditCards={creditCards}
        wallets={wallets}
        suppliers={suppliers}
        clients={clients}
        categories={categories}
        cardTerminals={cardTerminals}
        allCardTerminals={allCardTerminals}
        allAccounts={allAccounts}
        companies={companies}
        fieldSettings={fieldSettings}
      />

      {/* Detail Modal */}
      <TransactionDetailModal
        transaction={detailTarget}
        onClose={() => setDetailTarget(null)}
        categories={categories}
        allCategories={allCategories}
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
                category: liquidateTarget.category,
                subcategory: liquidateTarget.subcategory,
                subcategory2: liquidateTarget.subcategory2,
                installment_number: liquidateTarget.installment_number,
                installments_total: liquidateTarget.installments_total,
                original_amount: liquidateTarget.original_amount,
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

      {/* Import Statement */}
      <ImportStatementModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={createMultipleTransactions}
        bankAccounts={bankAccounts}
        wallets={wallets}
        creditCards={creditCards}
        categories={categories}
      />
    </div>
  );
}
