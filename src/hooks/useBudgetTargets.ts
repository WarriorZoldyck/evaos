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
  const [rows, setRows] = useState<{ kind: BudgetKind; category_name: string; target_amount: number }[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(async () => {
        await supabase.from("budget_targets").upsert(
          {
            user_id: effectiveUserId,
            company_id: companyId,
            kind,
            category_name: categoryName,
            target_amount: value,
          },
          { onConflict: "user_id,kind,category_name,company_id" },
        );
      }, DEBOUNCE_MS);
    },
    [effectiveUserId, companyId],
  );

  const clearKind = useCallback(
    async (kind: BudgetKind) => {
      setRows((prev) => prev.filter((r) => r.kind !== kind));
      if (!effectiveUserId) return;
      let q = supabase.from("budget_targets").delete().eq("user_id", effectiveUserId).eq("kind", kind);
      q = companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
      await q;
    },
    [effectiveUserId, companyId],
  );

  return { loading, income: maps.income, expense: maps.expense, setTarget, clearKind, refetch: fetchTargets };
}
