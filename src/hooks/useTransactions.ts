import { mapDatabaseError } from "@/lib/errorMapper";
import { collectCategoryBranchIds } from "@/lib/categoryTree";

import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Transaction = Tables<"transactions">;
export type TransactionInsert = TablesInsert<"transactions">;

export interface TransactionFilters {
  type: "receita" | "despesa" | "todos";
  status: "Pago" | "Pendente" | "todos";
  reconciled: "todos" | "sim" | "nao";
  search: string;
  categoryId: string;
  dateFrom: string;
  dateTo: string;
  dateField?: "payment_date" | "competence_date";
  sortOrder: "desc" | "asc";
  accountId: string;
  supplierId: string;
  clientId: string;
}

interface BankAccount {
  id: string;
  name: string;
  type: string;
}

export interface CreditCard {
  id: string;
  name: string;
  last_four_digits: string | null;
  closing_day: number;
  due_day: number;
  bank_account_id: string;
  parent_card_id?: string | null;
  company_id?: string | null;
}

interface Wallet {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

export interface CardTerminalInfo {
  id: string;
  name: string;
  acquirer: string | null;
  bank_account_id: string;
  debit_rate: number | null;
  credit_rate: number | null;
  settlement_days_debit: number | null;
  settlement_days_credit: number | null;
  rates_info: string | null;
  auto_anticipation: boolean;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  type: string | null;
}

const PAGE_SIZE = 20;

export function useTransactions() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<TransactionFilters>(() => {
    const now = new Date();
    return {
      type: "todos",
      status: "todos",
      reconciled: "todos",
      search: "",
      categoryId: "",
      dateFrom: format(startOfMonth(now), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(now), "yyyy-MM-dd"),
      sortOrder: "desc",
      accountId: "",
      supplierId: "",
      clientId: "",
    };
  });

  // Auxiliary data
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [cardTerminals, setCardTerminals] = useState<CardTerminalInfo[]>([]);

  // All accounts across all contexts (for transfers)
  const [allAccounts, setAllAccounts] = useState<{
    bankAccounts: { id: string; name: string; company_id: string | null; company_name: string }[];
    wallets: { id: string; name: string; company_id: string | null; company_name: string }[];
    creditCards: { id: string; name: string; last_four_digits: string | null; company_id: string | null; company_name: string; bank_account_id: string; parent_card_id: string | null }[];
  }>({ bankAccounts: [], wallets: [], creditCards: [] });

  // All card terminals across all contexts (for context switching in modal)
  const [allCardTerminals, setAllCardTerminals] = useState<(CardTerminalInfo & { company_id: string | null })[]>([]);

  const companyFilter = useCallback(
    (query: any) => {
      if (isPersonal) {
        return query.is("company_id", null);
      } else if (selectedCompanyId) {
        return query.eq("company_id", selectedCompanyId);
      }
      return query;
    },
    [isPersonal, selectedCompanyId]
  );

  // Fetch auxiliary data (extracted so it can be called on demand)
  const fetchAux = useCallback(async () => {
    if (!user || !effectiveUserId) return;
    const [accRes, cardRes, walletRes, supplierRes, clientRes, catRes, termRes, allCatRes] =
      await Promise.all([
        companyFilter(supabase.from("bank_accounts").select("id, name, type").eq("user_id", effectiveUserId)).order("name"),
        companyFilter(supabase.from("credit_cards").select("id, name, last_four_digits, closing_day, due_day, bank_account_id, parent_card_id, company_id").eq("user_id", effectiveUserId)).order("name"),
        companyFilter(supabase.from("wallets").select("id, name").eq("user_id", effectiveUserId)).order("name"),
        supabase.from("suppliers").select("id, name").eq("user_id", effectiveUserId).order("name"),
        supabase.from("clients").select("id, name").eq("user_id", effectiveUserId).order("name"),
        companyFilter(supabase.from("categories").select("id, name, parent_id, type").eq("user_id", effectiveUserId)).order("name"),
        companyFilter(supabase.from("card_terminals").select("id, name, acquirer, bank_account_id, debit_rate, credit_rate, settlement_days_debit, settlement_days_credit, rates_info, auto_anticipation").eq("user_id", effectiveUserId)).order("name"),
        supabase.from("categories").select("id, name, parent_id, type").eq("user_id", effectiveUserId).order("name"),
      ]);

    if (accRes.data) setBankAccounts(accRes.data);
    if (cardRes.data) setCreditCards(cardRes.data);
    if (walletRes.data) setWallets(walletRes.data);
    if (supplierRes.data) setSuppliers(supplierRes.data);
    if (clientRes.data) setClients(clientRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (allCatRes.data) setAllCategories(allCatRes.data);
    if (termRes.data) setCardTerminals(termRes.data as CardTerminalInfo[]);
  }, [user, effectiveUserId, companyFilter]);

  // Fetch ALL accounts (no company filter) for transfers
  const fetchAllAccounts = useCallback(async () => {
    if (!effectiveUserId) return;
    const [allAccRes, allWalletRes, allCardRes, companiesRes, allTermRes] = await Promise.all([
      supabase.from("bank_accounts").select("id, name, company_id").eq("user_id", effectiveUserId).order("name"),
      supabase.from("wallets").select("id, name, company_id").eq("user_id", effectiveUserId).order("name"),
      supabase.from("credit_cards").select("id, name, last_four_digits, company_id, bank_account_id, parent_card_id").eq("user_id", effectiveUserId).order("name"),
      supabase.from("companies").select("id, name").eq("user_id", effectiveUserId).order("name"),
      supabase.from("card_terminals").select("id, name, acquirer, bank_account_id, debit_rate, credit_rate, settlement_days_debit, settlement_days_credit, rates_info, auto_anticipation, company_id").eq("user_id", effectiveUserId).order("name"),
    ]);

    const companyMap = new Map<string, string>();
    if (companiesRes.data) {
      companiesRes.data.forEach((c) => companyMap.set(c.id, c.name));
    }

    const getCompanyName = (companyId: string | null) =>
      companyId ? companyMap.get(companyId) || "Empresa" : "Pessoal";

    setAllAccounts({
      bankAccounts: (allAccRes.data || []).map((a) => ({
        ...a,
        company_name: getCompanyName(a.company_id),
      })),
      wallets: (allWalletRes.data || []).map((w) => ({
        ...w,
        company_name: getCompanyName(w.company_id),
      })),
      creditCards: (allCardRes.data || []).map((c) => ({
        ...c,
        company_name: getCompanyName(c.company_id),
      })),
    });

    if (allTermRes.data) {
      setAllCardTerminals(allTermRes.data as (CardTerminalInfo & { company_id: string | null })[]);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    if (!user || !effectiveUserId) return;
    fetchAux();
    fetchAllAccounts();
  }, [user, effectiveUserId, companyFilter, fetchAux, fetchAllAccounts]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user || !effectiveUserId) return;
    setLoading(true);

    const selectedCardId = filters.accountId.startsWith("card:")
      ? filters.accountId.split(":").slice(1).join(":")
      : "";
    const selectedCardChildren = selectedCardId
      ? creditCards.filter((card) => card.parent_card_id === selectedCardId)
      : [];
    const isGroupedParentCardFilter = selectedCardChildren.length > 0;

    let query = supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .eq("user_id", effectiveUserId);

    query = companyFilter(query);

    if (filters.type !== "todos") {
      query = query.eq("type", filters.type);
    }
    if (filters.status !== "todos") {
      query = query.eq("status", filters.status);
    }
    if (filters.reconciled === "sim") {
      query = query.eq("is_reconciled", true);
    } else if (filters.reconciled === "nao") {
      query = query.or("is_reconciled.is.null,is_reconciled.eq.false");
    }
    if (filters.search.trim()) {
      query = query.or(`description.ilike.%${filters.search.trim()}%,contact_name.ilike.%${filters.search.trim()}%`);
    }
    if (filters.categoryId === "__sem_categoria__") {
      query = query.or("category.is.null,category.eq.");
    } else if (filters.categoryId) {
      const branchIds = collectCategoryBranchIds(allCategories, filters.categoryId);
      const branchNames = branchIds
        .map((id) => allCategories.find((c) => c.id === id)?.name)
        .filter((n): n is string => Boolean(n));
      const tokens = Array.from(new Set([...branchIds, ...branchNames]));
      const conditions = tokens.flatMap((token) => [
        `category.eq.${token}`,
        `subcategory.eq.${token}`,
        `subcategory2.eq.${token}`,
      ]);
      query = query.or(conditions.join(","));
    }

    const dateColumn = filters.dateField === "competence_date" ? "competence_date" : "payment_date";
    if (filters.dateFrom) {
      query = query.gte(dateColumn, filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte(dateColumn, filters.dateTo);
    }
    if (filters.accountId) {
      const [accType, ...idParts] = filters.accountId.split(":");
      const accId = idParts.join(":");
      if (accType === "bank") {
        query = query.eq("bank_account_id", accId);
      } else if (accType === "wallet") {
        query = query.eq("wallet_id", accId);
      } else if (accType === "card") {
        const children = creditCards.filter((c) => c.parent_card_id === accId);
        if (children.length > 0) {
          query = query.in("credit_card_id", [accId, ...children.map((c) => c.id)]);
        } else {
          query = query.eq("credit_card_id", accId);
        }
      }
    }
    if (filters.supplierId) {
      query = query.eq("supplier_id", filters.supplierId);
    }
    if (filters.clientId) {
      query = query.eq("client_id", filters.clientId);
    }

    const ascending = filters.sortOrder === "asc";
    const orderedQuery = query
      .order("payment_date", { ascending })
      .order("created_at", { ascending });

    // Quando há intervalo de datas (Hoje/Semana/Mês/Ano/mês específico), buscamos
    // tudo e deixamos a paginação para a UI (paginar por grupos/faturas inteiras).
    const hasDateRange = Boolean(filters.dateFrom && filters.dateTo);
    const isExhaustiveSearch = isGroupedParentCardFilter || filters.status === "Pendente" || hasDateRange;

    if (isExhaustiveSearch) {
      const allData: Transaction[] = [];
      let batchPage = 0;
      const batchSize = 1000;
      let resolvedCount: number | null = null;

      while (true) {
        const { data, count, error } = await orderedQuery.range(
          batchPage * batchSize,
          (batchPage + 1) * batchSize - 1
        );

        if (error) {
          toast({
            title: "Erro ao carregar lançamentos",
            description: mapDatabaseError(error),
            variant: "destructive",
          });
          setTransactions([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }

        if (resolvedCount === null) {
          resolvedCount = count ?? null;
        }
        if (!data || data.length === 0) break;

        allData.push(...data);

        if (data.length < batchSize) break;
        batchPage++;
      }

      setTransactions(allData);
      setTotalCount(resolvedCount ?? allData.length);
      setLoading(false);
      return;
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count, error } = await orderedQuery.range(from, to);

    if (error) {
      toast({
        title: "Erro ao carregar lançamentos",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
    } else {
      setTransactions(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [user, effectiveUserId, companyFilter, filters, page, toast, allCategories, creditCards]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filters, selectedCompanyId]);

  const createTransaction = async (data: TransactionInsert) => {
    const { error } = await supabase.from("transactions").insert(data);
    if (error) {
      toast({
        title: "Erro ao criar lançamento",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
      return false;
    }
    toast({ title: "Lançamento criado com sucesso!" });
    fetchTransactions();
    fetchAux();
    return true;
  };

  const createMultipleTransactions = async (data: TransactionInsert[]) => {
    const { error } = await supabase.from("transactions").insert(data);
    if (error) {
      toast({
        title: "Erro ao criar lançamentos",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
      return false;
    }

    toast({ title: `${data.length} lançamentos criados com sucesso!` });
    fetchTransactions();
    fetchAux();
    return true;
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    const { error } = await supabase
      .from("transactions")
      .update(data)
      .eq("id", id);
    if (error) {
      toast({
        title: "Erro ao atualizar lançamento",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
      return false;
    }
    toast({ title: "Lançamento atualizado!" });
    fetchTransactions();
    fetchAux();
    return true;
  };

  const deleteTransaction = async (id: string) => {
    // Guard: reconciled transactions cannot be deleted
    const { data: rec } = await supabase
      .from("transactions")
      .select("is_reconciled")
      .eq("id", id)
      .maybeSingle();
    if (rec?.is_reconciled) {
      toast({
        title: "Não é possível excluir",
        description: "Lançamentos conciliados não podem ser excluídos. Remova a conciliação primeiro.",
        variant: "destructive",
      });
      return false;
    }
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast({
        title: "Erro ao excluir lançamento",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
      return false;
    }
    toast({ title: "Lançamento excluído!" });
    fetchTransactions();
    return true;
  };

  const deleteMultipleTransactions = async (ids: string[]) => {
    if (ids.length === 0) return false;
    // Guard: filter out reconciled transactions
    const { data: recs } = await supabase
      .from("transactions")
      .select("id, is_reconciled")
      .in("id", ids);
    const reconciledIds = new Set((recs ?? []).filter((r) => r.is_reconciled).map((r) => r.id));
    const deletable = ids.filter((id) => !reconciledIds.has(id));
    if (deletable.length === 0) {
      toast({
        title: "Não é possível excluir",
        description: "Todos os lançamentos selecionados estão conciliados.",
        variant: "destructive",
      });
      return false;
    }
    const { error } = await supabase.from("transactions").delete().in("id", deletable);
    if (error) {
      toast({
        title: "Erro ao excluir lançamentos",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
      return false;
    }
    if (reconciledIds.size > 0) {
      toast({
        title: `${deletable.length} excluído${deletable.length > 1 ? "s" : ""}`,
        description: `${reconciledIds.size} conciliado${reconciledIds.size > 1 ? "s foram ignorados" : " foi ignorado"}.`,
      });
    } else {
      toast({ title: `${deletable.length} lançamento${deletable.length > 1 ? "s" : ""} excluído${deletable.length > 1 ? "s" : ""}!` });
    }
    fetchTransactions();
    return true;
  };

  const deleteSeriesTransactions = async (
    seriesId: string,
    mode: "only" | "from" | "all",
    currentInstallment?: number
  ) => {
    let query = supabase.from("transactions").delete().eq("series_id", seriesId);

    if (mode === "from" && currentInstallment !== undefined) {
      query = query.gte("installment_number", currentInstallment);
    }
    // mode === "all" deletes all with that series_id
    // mode === "only" is handled by caller using deleteTransaction

    const { error } = await query;
    if (error) {
      toast({
        title: "Erro ao excluir série",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
      return false;
    }
    toast({ title: "Lançamentos da série excluídos!" });
    fetchTransactions();
    return true;
  };

  const duplicateTransaction = async (transaction: Transaction) => {
    const { id, created_at, ...rest } = transaction;
    const newData: TransactionInsert = {
      ...rest,
      series_id: null,
      installment_number: null,
      installments_total: null,
      transfer_id: null,
    };
    return createTransaction(newData);
  };

  const redistributeSeriesAmounts = async (
    seriesId: string,
    excludeId: string,
    newTotalRemaining: number
  ) => {
    // Fetch pending installments in this series (excluding the current one)
    const { data: pendingInstallments, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("series_id", seriesId)
      .eq("status", "Pendente")
      .neq("id", excludeId)
      .order("installment_number", { ascending: true });

    if (error || !pendingInstallments || pendingInstallments.length === 0) {
      return { success: false, count: 0 };
    }

    const count = pendingInstallments.length;
    const amountPerInstallment = Math.round((newTotalRemaining / count) * 100) / 100;

    // Update each pending installment
    const ids = pendingInstallments.map((p) => p.id);
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ amount: amountPerInstallment })
      .in("id", ids);

    if (updateError) {
      toast({
        title: "Erro ao redistribuir parcelas",
        description: mapDatabaseError(updateError),
        variant: "destructive",
      });
      return { success: false, count: 0 };
    }

    return { success: true, count };
  };

  const updateMultipleTransactions = async (updates: Array<{ id: string; amount: number; payment_date?: string }>) => {
    if (updates.length === 0) return true;
    const promises = updates.map((u) => {
      const updateData: { amount: number; payment_date?: string } = { amount: u.amount };
      if (u.payment_date) updateData.payment_date = u.payment_date;
      return supabase.from("transactions").update(updateData).eq("id", u.id);
    });
    const results = await Promise.all(promises);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast({
        title: "Erro ao atualizar parcelas",
        description: mapDatabaseError(failed.error),
        variant: "destructive",
      });
      return false;
    }
    toast({ title: `${updates.length} parcela(s) atualizada(s)!` });
    fetchTransactions();
    return true;
  };

  const reconcileMultipleTransactions = async (ids: string[], reconciled: boolean) => {
    if (ids.length === 0) return false;
    const { error } = await supabase
      .from("transactions")
      .update({ is_reconciled: reconciled })
      .in("id", ids);
    if (error) {
      toast({
        title: reconciled ? "Erro ao conciliar" : "Erro ao desconciliar",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
      return false;
    }
    toast({
      title: reconciled
        ? `${ids.length} lançamento${ids.length > 1 ? "s conciliados" : " conciliado"}!`
        : `${ids.length} lançamento${ids.length > 1 ? "s desconciliados" : " desconciliado"}!`,
    });
    fetchTransactions();
    return true;
  };

  const moveTransactionsToContext = async (ids: string[], companyId: string | null) => {
    if (ids.length === 0) return false;
    const { error } = await supabase
      .from("transactions")
      .update({ company_id: companyId })
      .in("id", ids);
    if (error) {
      toast({
        title: "Erro ao mover lançamentos",
        description: mapDatabaseError(error),
        variant: "destructive",
      });
      return false;
    }
    toast({
      title: `${ids.length} lançamento${ids.length > 1 ? "s movidos" : " movido"} de contexto!`,
    });
    fetchTransactions();
    return true;
  };



  const groupedParentCardFilterActive = (() => {
    if (!filters.accountId.startsWith("card:")) return false;
    const selectedCardId = filters.accountId.split(":").slice(1).join(":");
    return creditCards.some((card) => card.parent_card_id === selectedCardId);
  })();

  const hasDateRangeActive = Boolean(filters.dateFrom && filters.dateTo);
  const exhaustiveActive =
    groupedParentCardFilterActive || filters.status === "Pendente" || hasDateRangeActive;

  // In exhaustive mode the server returns all rows; pagination happens in the UI
  // over grouped renderItems, so we expose totalPages=1 here and let the table
  // manage its own page state via setPage/page (kept as-is, not zeroed).
  const totalPages = exhaustiveActive
    ? totalCount > 0
      ? 1
      : 0
    : Math.ceil(totalCount / PAGE_SIZE);
  const effectivePage = page;

  return {
    transactions,
    loading,
    totalCount,
    page: effectivePage,
    setPage,
    totalPages,
    exhaustiveActive,
    filters,
    setFilters,
    fetchTransactions,
    refetchCategories: fetchAux,
    createTransaction,
    createMultipleTransactions,
    updateTransaction,
    deleteTransaction,
    deleteMultipleTransactions,
    reconcileMultipleTransactions,
    moveTransactionsToContext,

    deleteSeriesTransactions,
    duplicateTransaction,
    redistributeSeriesAmounts,
    updateMultipleTransactions,
    // Auxiliary data
    bankAccounts,
    creditCards,
    wallets,
    suppliers,
    clients,
    categories,
    allCategories,
    cardTerminals,
    allCardTerminals,
    allAccounts,
    refetchAccounts: async () => { await Promise.all([fetchAux(), fetchAllAccounts()]); },
  };
}
