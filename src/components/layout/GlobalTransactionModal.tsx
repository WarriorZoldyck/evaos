import { useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useFormFieldSettings } from "@/hooks/useFormFieldSettings";
import { useCompany } from "@/contexts/CompanyContext";
import { TransactionFormModal } from "@/components/lancamentos/TransactionFormModal";

interface GlobalTransactionModalProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalTransactionModal({ open, onClose }: GlobalTransactionModalProps) {
  const { companies } = useCompany();
  const { settings: fieldSettings } = useFormFieldSettings();
  const {
    createTransaction,
    createMultipleTransactions,
    updateTransaction,
    bankAccounts,
    creditCards,
    wallets,
    suppliers,
    clients,
    categories,
    cardTerminals,
    allAccounts,
  } = useTransactions();

  const handleClose = () => {
    onClose();
  };

  const handleSave = async (...args: Parameters<typeof createTransaction>) => {
    const result = await createTransaction(...args);
    if (result) {
      // Notify Lancamentos page (if open) to refresh
      window.dispatchEvent(new CustomEvent("transaction-created"));
    }
    return result;
  };

  const handleSaveMultiple = async (...args: Parameters<typeof createMultipleTransactions>) => {
    const result = await createMultipleTransactions(...args);
    if (result) {
      window.dispatchEvent(new CustomEvent("transaction-created"));
    }
    return result;
  };

  if (!open) return null;

  return (
    <TransactionFormModal
      open={open}
      onClose={handleClose}
      editTransaction={null}
      onSave={handleSave}
      onSaveMultiple={handleSaveMultiple}
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
  );
}
