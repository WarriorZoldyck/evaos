import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Transaction = Tables<"transactions">;
export type TransactionInsert = TablesInsert<"transactions">;

export interface TransactionFilters {
  type: "receita" | "despesa" | "todos";
  status: "Pago" | "Pendente" | "todos";
  search: string;
  categoryId: string;
  dateFrom: string;
  dateTo: string;
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
  const [cardTerminals, setCardTerminals] = useState<CardTerminalInfo[]>([]);

  // All accounts across all contexts (for transfers)
  const [allAccounts, setAllAccounts] = useState<{
    bankAccounts: { id: string; name: string; company_id: string | null; company_name: string }[];
    wallets: { id: string; name: string; company_id: string | null; company_name: string }[];
    creditCards: { id: string; name: string; last_four_digits: string | null; company_id: string | null; company_name: string }[];
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
    if (!user) return;
    const [accRes, cardRes, walletRes, supplierRes, clientRes, catRes, termRes] =
      await Promise.all([
        companyFilter(supabase.from("bank_accounts").select("id, name, type")).order("name"),
        companyFilter(supabase.from("credit_cards").select("id, name, last_four_digits, closing_day, due_day, bank_account_id")).order("name"),
        companyFilter(supabase.from("wallets").select("id, name")).order("name"),
        supabase.from("suppliers").select("id, name").order("name"),
        supabase.from("clients").select("id, name").order("name"),
        companyFilter(supabase.from("categories").select("id, name, parent_id, type")).order("name"),
        companyFilter(supabase.from("card_terminals").select("id, name, acquirer, bank_account_id, debit_rate, credit_rate, settlement_days_debit, settlement_days_credit, rates_info")).order("name"),
      ]);

    if (accRes.data) setBankAccounts(accRes.data);
    if (cardRes.data) setCreditCards(cardRes.data);
    if (walletRes.data) setWallets(walletRes.data);
    if (supplierRes.data) setSuppliers(supplierRes.data);
    if (clientRes.data) setClients(clientRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (termRes.data) setCardTerminals(termRes.data as CardTerminalInfo[]);
  }, [user, companyFilter]);

  useEffect(() => {
    fetchAux();

    // Fetch ALL accounts (no company filter) for transfers
    const fetchAllAccounts = async () => {
      const [allAccRes, allWalletRes, allCardRes, companiesRes, allTermRes] = await Promise.all([
        supabase.from("bank_accounts").select("id, name, company_id").order("name"),
        supabase.from("wallets").select("id, name, company_id").order("name"),
        supabase.from("credit_cards").select("id, name, last_four_digits, company_id").order("name"),
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("card_terminals").select("id, name, acquirer, bank_account_id, debit_rate, credit_rate, settlement_days_debit, settlement_days_credit, rates_info, company_id").order("name"),
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

      // Store all terminals with company_id for context filtering
      if (allTermRes.data) {
        setAllCardTerminals(allTermRes.data as (CardTerminalInfo & { company_id: string | null })[]);
      }
    };

    fetchAllAccounts();
  }, [user, companyFilter]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("transactions")
      .select("*", { count: "exact" });

    query = companyFilter(query);

    if (filters.type !== "todos") {
      query = query.eq("type", filters.type);
    }
    if (filters.status !== "todos") {
      query = query.eq("status", filters.status);
    }
    if (filters.search.trim()) {
      query = query.or(`description.ilike.%${filters.search.trim()}%,contact_name.ilike.%${filters.search.trim()}%`);
    }
    if (filters.categoryId) {
      query = query.eq("category", filters.categoryId);
    }
    if (filters.dateFrom) {
      query = query.gte("payment_date", filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte("payment_date", filters.dateTo);
    }
    if (filters.accountId) {
      // Could be bank:id or wallet:id
      const [accType, ...idParts] = filters.accountId.split(":");
      const accId = idParts.join(":");
      if (accType === "bank") {
        query = query.eq("bank_account_id", accId);
      } else if (accType === "wallet") {
        query = query.eq("wallet_id", accId);
      } else if (accType === "card") {
        query = query.eq("credit_card_id", accId);
      }
    }
    if (filters.supplierId) {
      query = query.eq("supplier_id", filters.supplierId);
    }
    if (filters.clientId) {
      query = query.eq("client_id", filters.clientId);
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const ascending = filters.sortOrder === "asc";

    const { data, count, error } = await query
      .order("payment_date", { ascending })
      .order("created_at", { ascending })
      .range(from, to);

    if (error) {
      toast({
        title: "Erro ao carregar lançamentos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTransactions(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [user, companyFilter, filters, page, toast]);

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
        description: error.message,
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
        description: error.message,
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
        description: error.message,
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
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast({
        title: "Erro ao excluir lançamento",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
    toast({ title: "Lançamento excluído!" });
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
        description: error.message,
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
        description: updateError.message,
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
        description: failed.error.message,
        variant: "destructive",
      });
      return false;
    }
    toast({ title: `${updates.length} parcela(s) atualizada(s)!` });
    fetchTransactions();
    return true;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return {
    transactions,
    loading,
    totalCount,
    page,
    setPage,
    totalPages,
    filters,
    setFilters,
    fetchTransactions,
    refetchCategories: fetchAux,
    createTransaction,
    createMultipleTransactions,
    updateTransaction,
    deleteTransaction,
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
    cardTerminals,
    allCardTerminals,
    allAccounts,
  };
}
