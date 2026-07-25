import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-center justify-between gap-4 mb-4 pt-4 md:pt-6">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar para Lançamentos
        </Button>
      </div>

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
