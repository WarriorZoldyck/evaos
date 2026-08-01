import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { supabase } from "@/integrations/supabase/client";
import {
  ImportStatementModal,
  type ReviewBatch,
  type ReviewBatchItem,
} from "@/components/lancamentos/ImportStatementModal";

export default function ImportarExtrato() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const effectiveUserId = useEffectiveUserId();
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

  // ── Modo "Revisar importação" ───────────────────────────────────────────
  // /importar-extrato?revisar=1&de=2026-07-30&ate=2026-07-31[&cartoes=id1,id2]
  const isReview = searchParams.get("revisar") === "1";
  const fromDate = searchParams.get("de") || "";
  const toDate = searchParams.get("ate") || "";
  const cardsParam = searchParams.get("cartoes") || "";

  const [reviewBatch, setReviewBatch] = useState<ReviewBatch | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string>("");

  useEffect(() => {
    if (!isReview || !effectiveUserId || !fromDate || !toDate) return;
    let cancelled = false;
    setLoadingBatch(true);
    (async () => {
      // `ate` é inclusivo em dias — somamos 1 dia para cobrir o dia inteiro.
      const end = new Date(`${toDate}T00:00:00`);
      end.setDate(end.getDate() + 1);
      const endISO = end.toISOString().slice(0, 10);

      let query = supabase
        .from("transactions")
        .select(
          "id, description, amount, type, payment_date, competence_date, purchase_date_original, status, category, subcategory, subcategory2, supplier_id, client_id, credit_card_id",
        )
        .eq("user_id", effectiveUserId)
        .gte("created_at", `${fromDate}T00:00:00Z`)
        .lt("created_at", `${endISO}T00:00:00Z`)
        .order("payment_date", { ascending: true })
        .limit(2000);

      const cardIds = cardsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (cardIds.length > 0) query = query.in("credit_card_id", cardIds);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setBatchError(error.message);
        setLoadingBatch(false);
        return;
      }
      const items: ReviewBatchItem[] = (data || []).map((t: any) => ({
        id: t.id,
        date: t.purchase_date_original || t.competence_date || t.payment_date,
        description: t.description || "",
        amount: Number(t.amount) || 0,
        type: t.type,
        category: t.category,
        subcategory: t.subcategory,
        subcategory2: t.subcategory2,
        supplier_id: t.supplier_id,
        client_id: t.client_id,
        payment_date: t.payment_date,
        competence_date: t.competence_date,
        status: t.status,
        credit_card_id: t.credit_card_id,
      }));
      setReviewBatch({
        key: `${fromDate}_${toDate}_${cardIds.join("-") || "all"}`,
        label: `Revisão da importação de ${fromDate.split("-").reverse().join("/")} a ${toDate
          .split("-")
          .reverse()
          .join("/")}`,
        items,
      });
      setLoadingBatch(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReview, effectiveUserId, fromDate, toDate, cardsParam]);

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

  if (isReview && (loadingBatch || (!reviewBatch && !batchError))) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        Carregando lançamentos para revisão…
      </div>
    );
  }

  if (isReview && batchError) {
    return (
      <div className="py-24 text-center text-sm text-destructive">
        Não foi possível carregar o lote: {batchError}
      </div>
    );
  }

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
        reviewBatch={isReview ? reviewBatch : null}
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
