import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
      <div className="sticky top-0 z-40 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-4 flex items-center justify-between gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
          <X className="h-4 w-4" />
          Cancelar importação
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
