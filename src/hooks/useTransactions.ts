import { useState, useEffect, useCallback } from "react";
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
}

interface BankAccount {
  id: string;
  name: string;
  type: string;
}

interface CreditCard {
  id: string;
  name: string;
  last_four_digits: string | null;
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
  const [filters, setFilters] = useState<TransactionFilters>({
    type: "todos",
    status: "todos",
    search: "",
    categoryId: "",
    dateFrom: "",
    dateTo: "",
  });

  // Auxiliary data
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cardTerminals, setCardTerminals] = useState<CardTerminalInfo[]>([]);

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

  // Fetch auxiliary data
  useEffect(() => {
    if (!user) return;

    const fetchAux = async () => {
      const [accRes, cardRes, walletRes, supplierRes, clientRes, catRes, termRes] =
        await Promise.all([
          companyFilter(supabase.from("bank_accounts").select("id, name, type")).order("name"),
          companyFilter(supabase.from("credit_cards").select("id, name, last_four_digits")).order("name"),
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
    };

    fetchAux();
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

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count, error } = await query
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
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
    createTransaction,
    createMultipleTransactions,
    updateTransaction,
    deleteTransaction,
    deleteSeriesTransactions,
    duplicateTransaction,
    // Auxiliary data
    bankAccounts,
    creditCards,
    wallets,
    suppliers,
    clients,
    categories,
    cardTerminals,
  };
}
