import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import type { BudgetKind } from "@/lib/budgetProgress";

export interface BudgetTargetsApi {
  loading: boolean;
  /** true enquanto houver gravação pendente ou em curso. */
  saving: boolean;
  /** Mensagem da última falha de gravação (null quando tudo certo). */
  error: string | null;
  /** Alvo mensal salvo por categoria, separado por tipo. */
  income: Record<string, number>;
  expense: Record<string, number>;
  setTarget: (kind: BudgetKind, categoryName: string, amount: number) => void;
  clearKind: (kind: BudgetKind) => Promise<void>;
  /** Grava imediatamente tudo que está no debounce (ao sair da página). */
  flush: () => Promise<void>;
  refetch: () => void;
}


const DEBOUNCE_MS = 600;

/**
 * Metas orçamentárias por categoria, persistidas por contexto (Pessoal/Empresa).
 * A gravação é adiada (debounce) para acompanhar o slider sem inundar o banco.
 */
export function useBudgetTargets(): BudgetTargetsApi {
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const companyId = isPersonal ? null : selectedCompanyId ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<{ kind: BudgetKind; category_name: string; target_amount: number }[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Gravações pendentes (chave -> payload), usadas pelo debounce e pelo flush. */
  const pending = useRef<Record<string, { kind: BudgetKind; categoryName: string; value: number }>>({});
  const inFlight = useRef(0);

  const fetchTargets = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    let q = supabase
      .from("budget_targets")
      .select("kind, category_name, target_amount")
      .eq("user_id", effectiveUserId);
    q = companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
    const { data } = await q;
    setRows((data as any) || []);
    setLoading(false);
  }, [effectiveUserId, companyId]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    [],
  );

  const maps = useMemo(() => {
    const income: Record<string, number> = {};
    const expense: Record<string, number> = {};
    rows.forEach((r) => {
      const bucket = r.kind === "income" ? income : expense;
      bucket[r.category_name] = Number(r.target_amount) || 0;
    });
    return { income, expense };
  }, [rows]);

  const writeKey = useCallback(
    async (key: string) => {
      const job = pending.current[key];
      if (!job || !effectiveUserId) return;
      delete pending.current[key];
      inFlight.current += 1;
      setSaving(true);
      const { error: upsertError } = await supabase.from("budget_targets").upsert(
        {
          user_id: effectiveUserId,
          company_id: companyId,
          kind: job.kind,
          category_name: job.categoryName,
          target_amount: job.value,
        },
        { onConflict: "user_id,kind,category_name,company_id" },
      );
      inFlight.current -= 1;
      if (upsertError) setError(upsertError.message);
      else setError(null);
      if (inFlight.current === 0 && Object.keys(pending.current).length === 0) setSaving(false);
    },
    [effectiveUserId, companyId],
  );

  const setTarget = useCallback(
    (kind: BudgetKind, categoryName: string, amount: number) => {
      const value = Math.max(0, Math.round((amount || 0) * 100) / 100);

      // Otimista: a UI reflete na hora, o banco alcança depois.
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.kind === kind && r.category_name === categoryName);
        if (idx === -1) return [...prev, { kind, category_name: categoryName, target_amount: value }];
        const next = [...prev];
        next[idx] = { ...next[idx], target_amount: value };
        return next;
      });

      if (!effectiveUserId) return;
      const key = `${kind}:${categoryName}`;
      pending.current[key] = { kind, categoryName, value };
      setSaving(true);
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        void writeKey(key);
      }, DEBOUNCE_MS);
    },
    [effectiveUserId, writeKey],
  );

  /** Descarrega imediatamente tudo que está aguardando o debounce. */
  const flush = useCallback(async () => {
    const keys = Object.keys(pending.current);
    keys.forEach((k) => clearTimeout(timers.current[k]));
    await Promise.all(keys.map((k) => writeKey(k)));
  }, [writeKey]);

  const clearKind = useCallback(
    async (kind: BudgetKind) => {
      setRows((prev) => prev.filter((r) => r.kind !== kind));
      // Descarta gravações pendentes desse tipo para não recriar o que foi apagado.
      Object.keys(pending.current)
        .filter((k) => k.startsWith(`${kind}:`))
        .forEach((k) => {
          clearTimeout(timers.current[k]);
          delete pending.current[k];
        });
      if (!effectiveUserId) return;
      let q = supabase.from("budget_targets").delete().eq("user_id", effectiveUserId).eq("kind", kind);
      q = companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
      const { error: deleteError } = await q;
      setError(deleteError?.message ?? null);
    },
    [effectiveUserId, companyId],
  );

  return {
    loading,
    saving,
    error,
    income: maps.income,
    expense: maps.expense,
    setTarget,
    clearKind,
    flush,
    refetch: fetchTargets,
  };

}
