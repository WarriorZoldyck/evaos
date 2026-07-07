import { useEffect, useMemo, useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { applyCompanyFilter } from "@/lib/companyFilter";

export interface MdrTerminal {
  id: string;
  name: string;
  acquirer: string | null;
  debit_rate: number | null;
  credit_rate: number | null;
  settlement_days_debit: number | null;
  settlement_days_credit: number | null;
  rates_info: string | null;
}

export interface MdrTransaction {
  id: string;
  description: string;
  amount: number;
  original_amount: number | null;
  payment_date: string;
  competence_date: string;
  card_terminal_id: string | null;
  payment_method: string | null;
  installments_total: number | null;
}

export interface MdrLineCalc {
  tx: MdrTransaction;
  terminal: MdrTerminal | null;
  gross: number;
  fee: number;
  net: number;
  rate: number;
  modality: string; // "Débito", "Crédito à vista", "Crédito 2x"...
}

export interface MdrMonthly {
  ym: string; // YYYY-MM
  label: string; // mmm/aa
  gross: number;
  fee: number;
  net: number;
  count: number;
  effectiveRate: number;
}

export interface MdrByTerminal {
  terminalId: string;
  terminalName: string;
  acquirer: string | null;
  gross: number;
  fee: number;
  net: number;
  count: number;
  effectiveRate: number;
}

export interface MdrByModality {
  modality: string;
  gross: number;
  fee: number;
  net: number;
  count: number;
  effectiveRate: number;
}

export interface MdrSummary {
  loading: boolean;
  currentMonth: { ym: string; gross: number; fee: number; net: number; count: number; effectiveRate: number };
  ytd: { gross: number; fee: number; net: number; count: number; effectiveRate: number };
  monthlySeries: MdrMonthly[]; // last 12 months
  byTerminal: MdrByTerminal[]; // for selected month
  byModality: MdrByModality[]; // for selected month
  selectedYm: string;
  setSelectedYm: (ym: string) => void;
  terminals: MdrTerminal[];
}

function computeLine(tx: MdrTransaction, terminal: MdrTerminal | null): MdrLineCalc {
  const persistedGross = tx.original_amount != null ? Number(tx.original_amount) : null;
  const net = Number(tx.amount);
  let rate = 0;
  let modality = "Outros";

  if (terminal) {
    const pm = tx.payment_method || "";
    if (pm === "Cartão de Débito") {
      rate = Number(terminal.debit_rate || 0);
      modality = "Débito";
    } else {
      const fallback = Number(terminal.credit_rate || 0);
      if (tx.installments_total && tx.installments_total >= 2) {
        modality = `Crédito ${tx.installments_total}x`;
        if (terminal.rates_info) {
          try {
            const rates = JSON.parse(terminal.rates_info);
            if (Array.isArray(rates)) {
              const match = rates.find(
                (r: { installments: number; rate: number }) => r.installments === tx.installments_total,
              );
              rate = match ? Number(match.rate) : fallback;
            } else rate = fallback;
          } catch {
            rate = fallback;
          }
        } else rate = fallback;
      } else {
        modality = "Crédito à vista";
        rate = fallback;
      }
    }
  }

  // Prefer persisted MDR when both gross and net are present
  let gross = persistedGross ?? net;
  let fee = 0;
  if (persistedGross != null && persistedGross > net) {
    fee = Math.round((persistedGross - net) * 100) / 100;
  } else {
    // Derive from rate
    gross = persistedGross ?? net; // if no persisted gross, treat amount as gross
    fee = Math.round(gross * (rate / 100) * 100) / 100;
  }

  return { tx, terminal, gross, fee, net: gross - fee, rate, modality };
}

export function useMdrSummary(): MdrSummary {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected } = useCompany();

  const [terminals, setTerminals] = useState<MdrTerminal[]>([]);
  const [transactions, setTransactions] = useState<MdrTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYm, setSelectedYm] = useState<string>(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    if (!user || !effectiveUserId) return;
    const ctx = { effectiveUserId, viewAll, selectedCompanyId, isPersonal, selectedCompanyIds, personalSelected };
    let cancelled = false;

    (async () => {
      setLoading(true);
      const from = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      const to = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const termQ = applyCompanyFilter(
        supabase
          .from("card_terminals")
          .select(
            "id, name, acquirer, debit_rate, credit_rate, settlement_days_debit, settlement_days_credit, rates_info",
          ),
        ctx,
      );
      const txQ = applyCompanyFilter(
        supabase
          .from("transactions")
          .select(
            "id, description, amount, original_amount, payment_date, competence_date, card_terminal_id, payment_method, installments_total",
          )
          .eq("type", "receita")
          .eq("status", "Pago")
          .not("card_terminal_id", "is", null)
          .gte("competence_date", from)
          .lte("competence_date", to),
        ctx,
      );

      const [termRes, txRes] = await Promise.all([termQ, txQ]);
      if (cancelled) return;
      setTerminals((termRes.data as MdrTerminal[]) || []);
      setTransactions((txRes.data as MdrTransaction[]) || []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, effectiveUserId, selectedCompanyId, isPersonal, viewAll, selectedCompanyIds, personalSelected]);

  const termMap = useMemo(() => {
    const m = new Map<string, MdrTerminal>();
    terminals.forEach((t) => m.set(t.id, t));
    return m;
  }, [terminals]);

  const lines = useMemo<MdrLineCalc[]>(
    () => transactions.map((tx) => computeLine(tx, tx.card_terminal_id ? termMap.get(tx.card_terminal_id) || null : null)),
    [transactions, termMap],
  );

  const monthlySeries = useMemo<MdrMonthly[]>(() => {
    const buckets = new Map<string, MdrMonthly>();
    // Pre-fill last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const ym = format(d, "yyyy-MM");
      buckets.set(ym, {
        ym,
        label: format(d, "MMM/yy"),
        gross: 0,
        fee: 0,
        net: 0,
        count: 0,
        effectiveRate: 0,
      });
    }
    lines.forEach((l) => {
      const ym = l.tx.competence_date.slice(0, 7);
      const b = buckets.get(ym);
      if (!b) return;
      b.gross += l.gross;
      b.fee += l.fee;
      b.net += l.net;
      b.count += 1;
    });
    return Array.from(buckets.values()).map((b) => ({
      ...b,
      effectiveRate: b.gross > 0 ? (b.fee / b.gross) * 100 : 0,
    }));
  }, [lines]);

  const monthLines = useMemo(
    () => lines.filter((l) => l.tx.competence_date.startsWith(selectedYm)),
    [lines, selectedYm],
  );

  const byTerminal = useMemo<MdrByTerminal[]>(() => {
    const map = new Map<string, MdrByTerminal>();
    monthLines.forEach((l) => {
      const id = l.terminal?.id || "unknown";
      const cur =
        map.get(id) || {
          terminalId: id,
          terminalName: l.terminal?.name || "Sem maquininha",
          acquirer: l.terminal?.acquirer || null,
          gross: 0,
          fee: 0,
          net: 0,
          count: 0,
          effectiveRate: 0,
        };
      cur.gross += l.gross;
      cur.fee += l.fee;
      cur.net += l.net;
      cur.count += 1;
      map.set(id, cur);
    });
    return Array.from(map.values())
      .map((b) => ({ ...b, effectiveRate: b.gross > 0 ? (b.fee / b.gross) * 100 : 0 }))
      .sort((a, b) => b.fee - a.fee);
  }, [monthLines]);

  const byModality = useMemo<MdrByModality[]>(() => {
    const map = new Map<string, MdrByModality>();
    monthLines.forEach((l) => {
      const cur =
        map.get(l.modality) || {
          modality: l.modality,
          gross: 0,
          fee: 0,
          net: 0,
          count: 0,
          effectiveRate: 0,
        };
      cur.gross += l.gross;
      cur.fee += l.fee;
      cur.net += l.net;
      cur.count += 1;
      map.set(l.modality, cur);
    });
    return Array.from(map.values())
      .map((b) => ({ ...b, effectiveRate: b.gross > 0 ? (b.fee / b.gross) * 100 : 0 }))
      .sort((a, b) => b.fee - a.fee);
  }, [monthLines]);

  const currentYm = format(new Date(), "yyyy-MM");
  const currentMonth = useMemo(() => {
    const m = monthlySeries.find((x) => x.ym === currentYm);
    return m
      ? { ym: m.ym, gross: m.gross, fee: m.fee, net: m.net, count: m.count, effectiveRate: m.effectiveRate }
      : { ym: currentYm, gross: 0, fee: 0, net: 0, count: 0, effectiveRate: 0 };
  }, [monthlySeries, currentYm]);

  const ytd = useMemo(() => {
    const yearPrefix = currentYm.slice(0, 4);
    const yLines = lines.filter((l) => l.tx.competence_date.startsWith(yearPrefix));
    const gross = yLines.reduce((s, l) => s + l.gross, 0);
    const fee = yLines.reduce((s, l) => s + l.fee, 0);
    const net = yLines.reduce((s, l) => s + l.net, 0);
    return {
      gross,
      fee,
      net,
      count: yLines.length,
      effectiveRate: gross > 0 ? (fee / gross) * 100 : 0,
    };
  }, [lines, currentYm]);

  return {
    loading,
    currentMonth,
    ytd,
    monthlySeries,
    byTerminal,
    byModality,
    selectedYm,
    setSelectedYm,
    terminals,
  };
}
