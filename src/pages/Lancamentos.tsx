import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useFormFieldSettings } from "@/hooks/useFormFieldSettings";
import { Plus, CreditCard, Upload, Sparkles, X } from "lucide-react";
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
import { TransactionFilters, TransactionPeriodFilter, TransactionSearchInput } from "@/components/lancamentos/TransactionFilters";
import { useHeaderSlot, useHeaderLeftSlot } from "@/contexts/HeaderSlotContext";
import { TransactionTable } from "@/components/lancamentos/TransactionTable";
import { TransactionFormModal } from "@/components/lancamentos/TransactionFormModal";
import { TransactionDetailModal } from "@/components/lancamentos/TransactionDetailModal";
import { SeriesEditDialog } from "@/components/lancamentos/SeriesEditDialog";
import { LiquidateModal } from "@/components/dashboard/LiquidateModal";
import { CreditCardBillPaymentModal } from "@/components/contas/CreditCardBillPaymentModal";

import { ExportTransactionsButton } from "@/components/lancamentos/ExportTransactionsButton";

type TabValue = "todos" | "realizado" | "projetado";

export default function Lancamentos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { companies } = useCompany();
  const { settings: fieldSettings } = useFormFieldSettings();

  const {
    transactions, loading, totalCount, page, setPage, totalPages, exhaustiveActive,
    filters, setFilters,
    createTransaction, createMultipleTransactions, updateTransaction,
    deleteTransaction, deleteMultipleTransactions, reconcileMultipleTransactions, deleteSeriesTransactions, duplicateTransaction,
    fetchTransactions, updateMultipleTransactions,
    bankAccounts, creditCards, wallets, suppliers, clients, categories,
    cardTerminals, allCardTerminals, allAccounts, allCategories, refetchAccounts,
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
  const [billPaymentCard, setBillPaymentCard] = useState<{ card: any; referenceDate?: Date } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

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
    const dateFieldParam = searchParams.get("dateField");
    const accountIdParam = searchParams.get("accountId");

    if (categoryParam || typeParam || statusParam || dateFromParam || dateToParam || dateFieldParam || accountIdParam) {
      const isUncategorizedSentinel = categoryParam === "__sem_categoria__";
      const matchedCat = !isUncategorizedSentinel
        ? categories.find((c) => c.name === categoryParam && !c.parent_id)
        : null;
      setFilters((prev) => ({
        ...prev,
        categoryId: isUncategorizedSentinel
          ? "__sem_categoria__"
          : matchedCat?.id || prev.categoryId,
        type: (typeParam as "receita" | "despesa") || prev.type,
        status: (statusParam as "Pago" | "Pendente") || prev.status,
        dateFrom: dateFromParam || prev.dateFrom,
        dateTo: dateToParam || prev.dateTo,
        dateField: (dateFieldParam === "competence_date" || dateFieldParam === "payment_date")
          ? dateFieldParam
          : prev.dateField,
        accountId: accountIdParam || prev.accountId,
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

  // One-time "new feature" banner: Conciliação inteligente no Importar Extrato
  const FEATURE_KEY = "eva.feature.import-match.seen.v1";
  const [showFeatureBanner, setShowFeatureBanner] = useState(() => {
    try { return localStorage.getItem(FEATURE_KEY) !== "1"; } catch { return false; }
  });
  const dismissFeatureBanner = () => {
    try { localStorage.setItem(FEATURE_KEY, "1"); } catch {}
    setShowFeatureBanner(false);
  };

  // Global header controls (period filter + Exportar/Importar/Novo Lançamento)
  const headerControls = useMemo(
    () => (
      <>
        <TransactionPeriodFilter filters={filters} onFiltersChange={setFilters} />
        <ExportTransactionsButton
          filters={filters}
          categories={categories}
          allCategories={allCategories}
          creditCards={creditCards}
          bankAccounts={bankAccounts}
          wallets={wallets}
          suppliers={suppliers}
          clients={clients}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/lancamentos/importar-extrato")}
          className="gap-1.5 h-8 shrink-0"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden 2xl:inline text-xs">Importar Extrato</span>
          <span className="hidden xl:inline 2xl:hidden text-xs">Importar</span>
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setEditingTransaction(null);
            setFormOpen(true);
          }}
          className="gap-1.5 h-8 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden 2xl:inline text-xs">Novo Lançamento</span>
          <span className="hidden xl:inline 2xl:hidden text-xs">Novo</span>
        </Button>
      </>
    ),
    [filters, setFilters, categories, allCategories, creditCards, bankAccounts, wallets, suppliers, clients],
  );
  useHeaderSlot(headerControls);

  const headerLeft = useMemo(
    () => <TransactionSearchInput filters={filters} onFiltersChange={setFilters} className="w-36 sm:w-48 lg:w-56 2xl:w-64 shrink-0" />,
    [filters, setFilters],
  );
  useHeaderLeftSlot(headerLeft);

  return (
    <div className="animate-fade-in pt-4 md:pt-6">
      {/* New feature announcement */}
      {showFeatureBanner && (
        <div className="relative mb-6 rounded-lg border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 pr-10">
          <button
            onClick={dismissFeatureBanner}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/15 p-2 shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">
                Novidade! Conciliação inteligente ao importar extrato 🎉
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Agora, ao importar um extrato bancário (OFX/CSV), o EVA identifica automaticamente quais lançamentos
                <strong className="text-foreground"> já estavam cadastrados como Pendentes</strong> e sugere
                <strong className="text-foreground"> vinculá-los</strong> em vez de criar duplicidade. Você decide linha
                por linha: <em>Vincular</em>, <em>Criar novo</em> ou <em>Ignorar</em>. Sem alteração nos seus dados existentes.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-7 text-xs"
                onClick={() => { dismissFeatureBanner(); navigate("/lancamentos/importar-extrato"); }}
              >
                <Upload className="h-3 w-3 mr-1" /> Experimentar agora
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header (title + Pagar Fatura contextual) */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Lançamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalCount} lançamento{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        {filters.accountId.startsWith("card:") && (() => {
          const cardId = filters.accountId.split(":").slice(1).join(":");
          const card = creditCards.find((c) => c.id === cardId);
          return card ? (
            <Button
              variant="outline"
              onClick={() => setBillPaymentCard({ card })}
              className="gap-2 shrink-0"
            >
              <CreditCard className="h-4 w-4" />
              Pagar Fatura
            </Button>
          ) : null;
        })()}
      </div>

      {/* Filters sticky bar (period + search moved to global header) */}
      <div className="sticky top-0 z-50 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-card border-y border-border/70 shadow-premium">
        <TransactionFilters
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          bankAccounts={bankAccounts}
          wallets={wallets}
          creditCards={creditCards}
          suppliers={suppliers}
          clients={clients}
          hidePeriod
          hideSearch
        />
      </div>



      {/* Tabs sticky bar (below filters) */}
      <div className="sticky top-[64px] z-40 -mx-4 md:-mx-6 px-4 md:px-6 pt-3 bg-card border-b border-border/70">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="realizado">Realizado</TabsTrigger>
            <TabsTrigger value="projetado">Projetado</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <Card className="relative z-0 rounded-t-none border-t-0">

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
            clientPaginate={exhaustiveActive}
            onEdit={handleEdit}
            onDuplicate={duplicateTransaction}
            onDelete={handleDelete}
            onDeleteMultiple={(ids) => setBulkDeleteIds(ids)}
            onReconcileMultiple={(ids, reconciled) => reconcileMultipleTransactions(ids, reconciled)}
            onLiquidate={(t) => {
              // If it's a credit card transaction, open bill payment flow positioned
              // on the cycle that contains this transaction. We use payment_date
              // (vencimento) because each fatura is defined by the payment month.
              if (t.credit_card_id) {
                const card = creditCards.find((c) => c.id === t.credit_card_id);
                if (card) {
                  const d = new Date(t.payment_date + "T12:00:00");
                  const ref = new Date(d.getFullYear(), d.getMonth(), 1);
                  setBillPaymentCard({ card, referenceDate: ref });
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
            if (card) {
              const d = new Date(t.payment_date + "T12:00:00");
              const ref = new Date(d.getFullYear(), d.getMonth(), 1);
              setBillPaymentCard({ card, referenceDate: ref });
              return;
            }
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

      {/* Bulk delete confirmation */}
      <AlertDialog
        open={!!bulkDeleteIds}
        onOpenChange={(o) => !o && setBulkDeleteIds(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {bulkDeleteIds?.length} lançamento{(bulkDeleteIds?.length ?? 0) > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {bulkDeleteIds?.length} lançamento{(bulkDeleteIds?.length ?? 0) > 1 ? "s" : ""} selecionado{(bulkDeleteIds?.length ?? 0) > 1 ? "s" : ""}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (bulkDeleteIds) {
                  await deleteMultipleTransactions(bulkDeleteIds);
                  setBulkDeleteIds(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir {bulkDeleteIds?.length}
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
        creditCard={billPaymentCard?.card ?? null}
        initialReferenceDate={billPaymentCard?.referenceDate}
        onClose={() => setBillPaymentCard(null)}
        onSuccess={() => {
          setBillPaymentCard(null);
          fetchTransactions();
        }}
      />

      {/* Import Statement moved to dedicated route: /lancamentos/importar-extrato */}

    </div>
  );
}
