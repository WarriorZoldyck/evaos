import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

export type BankAccount = Tables<"bank_accounts">;
export type CreditCard = Tables<"credit_cards">;
export type Wallet = Tables<"wallets">;
export type CardTerminal = Tables<"card_terminals">;

export function useAccounts() {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [cardTerminals, setCardTerminals] = useState<CardTerminal[]>([]);
  const [loading, setLoading] = useState(true);

  const companyFilter = useCallback(
    (query: any) => {
      if (isPersonal) return query.is("company_id", null);
      if (selectedCompanyId) return query.eq("company_id", selectedCompanyId);
      return query;
    },
    [isPersonal, selectedCompanyId]
  );

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [accRes, cardRes, walletRes, termRes] = await Promise.all([
      companyFilter(supabase.from("bank_accounts").select("*")).order("name"),
      companyFilter(supabase.from("credit_cards").select("*")).order("name"),
      companyFilter(supabase.from("wallets").select("*")).order("name"),
      companyFilter(supabase.from("card_terminals").select("*")).order("name"),
    ]);

    if (accRes.data) setBankAccounts(accRes.data);
    if (cardRes.data) setCreditCards(cardRes.data);
    if (walletRes.data) setWallets(walletRes.data);
    if (termRes.data) setCardTerminals(termRes.data);
    setLoading(false);
  }, [user, companyFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Bank Accounts CRUD
  const createBankAccount = async (data: { name: string; type: string; initial_balance: number; account_number?: string; agency_number?: string }) => {
    if (!user) return false;
    const { error } = await supabase.from("bank_accounts").insert({
      ...data,
      account_number: data.account_number || null,
      agency_number: data.agency_number || null,
      user_id: user.id,
      company_id: selectedCompanyId || null,
    });
    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Conta criada!" });
    fetchAll();
    return true;
  };

  const updateBankAccount = async (id: string, data: Partial<BankAccount>) => {
    const { error } = await supabase.from("bank_accounts").update(data).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar conta", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Conta atualizada!" });
    fetchAll();
    return true;
  };

  const deleteBankAccount = async (id: string) => {
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir conta", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Conta excluída!" });
    fetchAll();
    return true;
  };

  // Credit Cards CRUD
  const createCreditCard = async (data: { name: string; bank_account_id: string; closing_day: number; due_day: number; limit: number; last_four_digits?: string }) => {
    if (!user) return false;
    const { error } = await supabase.from("credit_cards").insert({
      ...data,
      last_four_digits: data.last_four_digits || null,
      user_id: user.id,
      company_id: selectedCompanyId || null,
    });
    if (error) {
      toast({ title: "Erro ao criar cartão", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Cartão criado!" });
    fetchAll();
    return true;
  };

  const updateCreditCard = async (id: string, data: Partial<CreditCard>) => {
    const { error } = await supabase.from("credit_cards").update(data).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar cartão", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Cartão atualizado!" });
    fetchAll();
    return true;
  };

  const deleteCreditCard = async (id: string) => {
    const { error } = await supabase.from("credit_cards").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir cartão", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Cartão excluído!" });
    fetchAll();
    return true;
  };

  // Wallets CRUD
  const createWallet = async (data: { name: string; initial_balance: number }) => {
    if (!user) return false;
    const { error } = await supabase.from("wallets").insert({
      ...data,
      user_id: user.id,
      company_id: selectedCompanyId || null,
    });
    if (error) {
      toast({ title: "Erro ao criar carteira", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Carteira criada!" });
    fetchAll();
    return true;
  };

  const updateWallet = async (id: string, data: Partial<Wallet>) => {
    const { error } = await supabase.from("wallets").update(data).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar carteira", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Carteira atualizada!" });
    fetchAll();
    return true;
  };

  const deleteWallet = async (id: string) => {
    const { error } = await supabase.from("wallets").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir carteira", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Carteira excluída!" });
    fetchAll();
    return true;
  };

  // Card Terminals CRUD
  const createCardTerminal = async (data: {
    name: string; acquirer?: string | null; bank_account_id: string;
    unique_id?: string | null; debit_rate?: number | null; credit_rate?: number | null;
    settlement_days_debit?: number | null; settlement_days_credit?: number | null;
    rates_info?: string | null;
  }) => {
    if (!user) return false;
    const { error } = await supabase.from("card_terminals").insert({
      name: data.name,
      acquirer: data.acquirer || null,
      bank_account_id: data.bank_account_id,
      unique_id: data.unique_id || null,
      debit_rate: data.debit_rate ?? null,
      credit_rate: data.credit_rate ?? null,
      settlement_days_debit: data.settlement_days_debit ?? null,
      settlement_days_credit: data.settlement_days_credit ?? null,
      rates_info: data.rates_info || null,
      user_id: user.id,
      company_id: selectedCompanyId || null,
    });
    if (error) {
      toast({ title: "Erro ao criar maquininha", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Maquininha criada!" });
    fetchAll();
    return true;
  };

  const updateCardTerminal = async (id: string, data: Partial<CardTerminal>) => {
    const { error } = await supabase.from("card_terminals").update(data).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar maquininha", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Maquininha atualizada!" });
    fetchAll();
    return true;
  };

  const deleteCardTerminal = async (id: string) => {
    const { error } = await supabase.from("card_terminals").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir maquininha", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Maquininha excluída!" });
    fetchAll();
    return true;
  };

  return {
    bankAccounts,
    creditCards,
    wallets,
    cardTerminals,
    loading,
    refetch: fetchAll,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
    createWallet,
    updateWallet,
    deleteWallet,
    createCardTerminal,
    updateCardTerminal,
    deleteCardTerminal,
  };
}
