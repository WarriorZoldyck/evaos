import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useTransactions } from "@/hooks/useTransactions";
import { ImportStatementModal } from "@/components/lancamentos/ImportStatementModal";

export default function ImportarExtrato() {
  const navigate = useNavigate();
  const { companies } = useCompany();
  const {
    createMultipleTransactions,
    bankAccounts,
    wallets,
    allAccounts,
    categories,
    allCategories,
    refetchAccounts,
    fetchTransactions,
  } = useTransactions();

  const [closing, setClosing] = useState(false);

  const goBack = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => navigate("/lancamentos"), 280);
  };

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  return (
    <div
      className={
        "animate-fade-in " +
        (closing
          ? "translate-x-full transition-transform duration-300 ease-in"
          : "animate-slide-in-right")
      }
    >
      <ImportStatementModal
        variant="page"
        open
        onClose={() => {
          fetchTransactions();
          goBack();
        }}
        onImport={createMultipleTransactions}
        bankAccounts={bankAccounts}
        wallets={wallets}
        creditCards={allAccounts.creditCards}
        allBankAccounts={allAccounts.bankAccounts}
        companies={companies}
        categories={categories}
        allCategories={allCategories}
        refetchAccounts={refetchAccounts}
      />
    </div>
  );
}
