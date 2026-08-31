import { mapDatabaseError } from "@/lib/errorMapper";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import {
  availableHours,
  productiveHours,
  countWorkingDays,
  DEFAULT_WEEKDAYS,
  type Weekday,
} from "@/lib/workHours";

export interface PricingV2Config {
  id: string;
  user_id: string;
  hours_per_month: number;
  num_rooms: number;
  tax_rate: number;
  days_per_week: number | null;
  hours_per_day: number | null;
  productive_loss_pct: number;
  work_weekdays: Weekday[];
  excluded_days: string[];
  updated_at: string | null;
}

export interface SaveConfigInput {
  hours: number;
  rooms: number;
  tax: number;
  daysPerWeek?: number | null;
  hoursPerDay?: number | null;
  productiveLossPct?: number;
  workWeekdays?: Weekday[];
  excludedDays?: string[];
}


export interface CostItem {
  id: string;
  config_id: string;
  user_id: string;
  cost_group: string;
  category: string;
  description: string;
  value: number;
  frequency: string;
  sort_order: number;
}

export type ItemUnitType = "sessao" | "unitario";

export interface ProcedureV2Item {
  id: string;
  procedure_id: string;
  description: string;
  value: number;
  unit_type: ItemUnitType;
}

export interface ProcedureV2 {
  id: string;
  user_id: string;
  name: string;
  execution_time: number;
  desired_price: number;
  quantity: number;
  created_at: string | null;
  items: ProcedureV2Item[];
}

export interface CostGroupTotals {
  fixos_clinica: number;
  variaveis_clinica: number;
  pessoais: number;
  total: number;
}

export type CostGroup = "fixos_clinica" | "variaveis_clinica" | "pessoais";

const COST_GROUP_LABELS: Record<CostGroup, string> = {
  fixos_clinica: "Despesas Fixas Clínica",
  variaveis_clinica: "Despesas Variáveis Clínica",
  pessoais: "Despesas Pessoais (Casa)",
};

export { COST_GROUP_LABELS };

const VALID_WEEKDAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

function parseWeekdays(raw: unknown): Weekday[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => Number(v))
    .filter((v) => VALID_WEEKDAYS.has(v)) as Weekday[];
}

function parseDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

function monthlyValue(item: CostItem): number {
  return item.frequency === "A" ? item.value / 12 : item.value;
}

export function usePricingV2() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [config, setConfig] = useState<PricingV2Config | null>(null);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [procedures, setProcedures] = useState<ProcedureV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);
  const updatingProcRef = useRef<Set<string>>(new Set());

  // ─── Computed totals ───
  const groupTotals: CostGroupTotals = (() => {
    const fixos = costItems.filter((i) => i.cost_group === "fixos_clinica").reduce((s, i) => s + monthlyValue(i), 0);
    const variaveis = costItems.filter((i) => i.cost_group === "variaveis_clinica").reduce((s, i) => s + monthlyValue(i), 0);
    const pessoais = costItems.filter((i) => i.cost_group === "pessoais").reduce((s, i) => s + monthlyValue(i), 0);
    return { fixos_clinica: fixos, variaveis_clinica: variaveis, pessoais, total: fixos + variaveis + pessoais };
  })();

  const numRooms = config?.num_rooms ?? 1;
  const taxRate = config?.tax_rate ?? 8.44;

  // Horas: quando há calendário configurado (dias da semana + horas/dia),
  // as horas disponíveis vêm da contagem real de dias do mês corrente.
  const workWeekdays = config?.work_weekdays ?? [];
  const excludedDays = config?.excluded_days ?? [];
  const hoursPerDay = config?.hours_per_day ?? null;
  const productiveLossPct = config?.productive_loss_pct ?? 0;

  const today = new Date();
  const calendarYear = today.getFullYear();
  const calendarMonth = today.getMonth() + 1;
  const workingDays =
    workWeekdays.length > 0
      ? countWorkingDays(calendarYear, calendarMonth, workWeekdays, excludedDays)
      : 0;

  const availableHoursMonth =
    workWeekdays.length > 0 && hoursPerDay && hoursPerDay > 0
      ? availableHours(workingDays, hoursPerDay)
      : config?.hours_per_month ?? 160;

  const productiveHoursMonth = productiveHours(availableHoursMonth, productiveLossPct);

  /** Horas efetivamente faturáveis — base de todo o custo/hora. */
  const hoursPerMonth = productiveHoursMonth;

  const custoHora = hoursPerMonth > 0 ? groupTotals.total / hoursPerMonth : 0;
  const fmm = groupTotals.total;
  const fmmPorSala = numRooms > 0 ? fmm / numRooms : fmm;
  const custoHoraPorSala = numRooms > 0 ? custoHora / numRooms : custoHora;


  // ─── Fetch config ───
  const fetchConfig = useCallback(async () => {
    if (!user) return null;
    let query = supabase
      .from("pricing_v2_configurations")
      .select("*")
      .eq("user_id", effectiveUserId);

    if (isPersonal) {
      query = query.is("company_id", null);
    } else if (selectedCompanyId) {
      query = query.eq("company_id", selectedCompanyId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      toast({ title: "Erro ao carregar configuração V2", description: mapDatabaseError(error), variant: "destructive" });
      return null;
    }
    if (data) {
      const parsed: PricingV2Config = {
        id: data.id,
        user_id: data.user_id,
        hours_per_month: data.hours_per_month ?? 160,
        num_rooms: data.num_rooms ?? 1,
        tax_rate: Number(data.tax_rate) ?? 8.44,
        days_per_week: data.days_per_week != null ? Number(data.days_per_week) : null,
        hours_per_day: data.hours_per_day != null ? Number(data.hours_per_day) : null,
        productive_loss_pct: Number((data as { productive_loss_pct?: number }).productive_loss_pct) || 0,
        work_weekdays: parseWeekdays((data as { work_weekdays?: unknown }).work_weekdays),
        excluded_days: parseDays((data as { excluded_days?: unknown }).excluded_days),
        updated_at: data.updated_at,
      };
      setConfig(parsed);
      return parsed;
    }
    return null;
  }, [user, effectiveUserId, toast, isPersonal, selectedCompanyId]);

  // ─── Save config ───
  const saveConfig = async (hours: number, rooms: number, tax: number, daysPerWeek?: number | null, hoursPerDay?: number | null) => {
    if (!user) return false;
    if (config) {
      const { error } = await supabase
        .from("pricing_v2_configurations")
        .update({
          hours_per_month: hours,
          num_rooms: Math.round(rooms * 1000) / 1000,
          tax_rate: tax,
          days_per_week: daysPerWeek ?? null,
          hours_per_day: hoursPerDay ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
      if (error) {
        toast({ title: "Erro ao salvar", description: mapDatabaseError(error), variant: "destructive" });
        return false;
      }
    } else {
      const { error } = await supabase.from("pricing_v2_configurations").insert({
        user_id: effectiveUserId,
        company_id: selectedCompanyId || null,
        hours_per_month: hours,
        num_rooms: Math.round(rooms * 1000) / 1000,
        tax_rate: tax,
        days_per_week: daysPerWeek ?? null,
        hours_per_day: hoursPerDay ?? null,
      });
      if (error) {
        toast({ title: "Erro ao criar configuração", description: mapDatabaseError(error), variant: "destructive" });
        return false;
      }
    }
    toast({ title: "Configuração salva!" });
    await fetchConfig();
    return true;
  };

  // ─── Fetch cost items ───
  const fetchCostItems = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from("pricing_v2_cost_items")
      .select("*")
      .eq("user_id", effectiveUserId);

    if (isPersonal) {
      query = query.is("company_id", null);
    } else if (selectedCompanyId) {
      query = query.eq("company_id", selectedCompanyId);
    }

    const { data, error } = await query.order("sort_order", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar itens de custo", description: mapDatabaseError(error), variant: "destructive" });
      return;
    }
    setCostItems(
      (data || []).map((d) => ({
        ...d,
        value: Number(d.value) || 0,
        sort_order: d.sort_order ?? 0,
      }))
    );
  }, [user, effectiveUserId, toast, isPersonal, selectedCompanyId]);

  // ─── Add cost item ───
  const addCostItem = async (item: {
    cost_group: string;
    category: string;
    description: string;
    value: number;
    frequency: string;
  }) => {
    if (!user) return false;

    if (!config) {
      const { data: newConfig, error: cfgErr } = await supabase
        .from("pricing_v2_configurations")
        .insert({ user_id: effectiveUserId, company_id: selectedCompanyId || null })
        .select()
        .single();
      if (cfgErr || !newConfig) {
        toast({ title: "Erro ao criar configuração", variant: "destructive" });
        return false;
      }
      setConfig({
        id: newConfig.id,
        user_id: newConfig.user_id,
        hours_per_month: newConfig.hours_per_month ?? 160,
        num_rooms: newConfig.num_rooms ?? 1,
        tax_rate: Number(newConfig.tax_rate) ?? 8.44,
        days_per_week: newConfig.days_per_week != null ? Number(newConfig.days_per_week) : null,
        hours_per_day: newConfig.hours_per_day != null ? Number(newConfig.hours_per_day) : null,
        productive_loss_pct: Number((newConfig as { productive_loss_pct?: number }).productive_loss_pct) || 0,
        work_weekdays: parseWeekdays((newConfig as { work_weekdays?: unknown }).work_weekdays),
        excluded_days: parseDays((newConfig as { excluded_days?: unknown }).excluded_days),
        updated_at: newConfig.updated_at,
      });
      const { error } = await supabase.from("pricing_v2_cost_items").insert({
        config_id: newConfig.id,
        user_id: effectiveUserId,
        company_id: selectedCompanyId || null,
        ...item,
      });
      if (error) {
        toast({ title: "Erro ao adicionar item", description: mapDatabaseError(error), variant: "destructive" });
        return false;
      }
    } else {
      const { error } = await supabase.from("pricing_v2_cost_items").insert({
        config_id: config.id,
        user_id: effectiveUserId,
        company_id: selectedCompanyId || null,
        ...item,
      });
      if (error) {
        toast({ title: "Erro ao adicionar item", description: mapDatabaseError(error), variant: "destructive" });
        return false;
      }
    }
    await fetchCostItems();
    return true;
  };

  // ─── Update cost item ───
  const updateCostItem = async (id: string, updates: Partial<Pick<CostItem, "category" | "description" | "value" | "frequency">>) => {
    const { error } = await supabase.from("pricing_v2_cost_items").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    await fetchCostItems();
    return true;
  };

  // ─── Delete cost item ───
  const deleteCostItem = async (id: string) => {
    const { error } = await supabase.from("pricing_v2_cost_items").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    await fetchCostItems();
    return true;
  };

  // ─── Procedures ───
  const fetchProcedures = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from("pricing_v2_procedures")
      .select("*")
      .eq("user_id", effectiveUserId);

    if (isPersonal) {
      query = query.is("company_id", null);
    } else if (selectedCompanyId) {
      query = query.eq("company_id", selectedCompanyId);
    }

    const { data: procs, error } = await query.order("name");

    if (error) {
      toast({ title: "Erro ao carregar procedimentos", description: mapDatabaseError(error), variant: "destructive" });
      return;
    }
    if (!procs || procs.length === 0) {
      setProcedures([]);
      return;
    }

    const procIds = procs.map((p) => p.id);
    const { data: items } = await supabase
      .from("pricing_v2_procedure_items")
      .select("*")
      .in("procedure_id", procIds);

    setProcedures(
      procs.map((p) => ({
        ...p,
        execution_time: Number(p.execution_time) || 1,
        desired_price: Number(p.desired_price) || 0,
        quantity: Number((p as { quantity?: number }).quantity) || 1,
        items: (items || [])
          .filter((i) => i.procedure_id === p.id)
          .map((i) => ({
            ...i,
            value: Number(i.value) || 0,
            unit_type: ((i as { unit_type?: string }).unit_type === "unitario" ? "unitario" : "sessao") as ItemUnitType,
          })),
      }))
    );
  }, [user, effectiveUserId, toast, isPersonal, selectedCompanyId]);

  const createProcedure = async (data: {
    name: string;
    execution_time: number;
    desired_price: number;
    quantity?: number;
    items: { description: string; value: number; unit_type?: ItemUnitType }[];
  }) => {
    if (!user) return false;
    const { data: proc, error } = await supabase
      .from("pricing_v2_procedures")
      .insert({ name: data.name, execution_time: data.execution_time, desired_price: data.desired_price, quantity: data.quantity ?? 1, user_id: effectiveUserId, company_id: selectedCompanyId || null })
      .select()
      .single();

    if (error || !proc) {
      toast({ title: "Erro ao criar procedimento", description: error?.message, variant: "destructive" });
      return false;
    }

    if (data.items.length > 0) {
      await supabase.from("pricing_v2_procedure_items").insert(
        data.items.map((i) => ({ procedure_id: proc.id, description: i.description, value: i.value, unit_type: i.unit_type ?? "sessao" }))
      );
    }

    toast({ title: "Procedimento criado!" });
    await fetchProcedures();
    return true;
  };

  const updateProcedure = async (id: string, data: {
    name: string;
    execution_time: number;
    desired_price: number;
    quantity?: number;
    items: { description: string; value: number; unit_type?: ItemUnitType }[];
  }) => {
    if (updatingProcRef.current.has(id)) return false;
    updatingProcRef.current.add(id);
    try {
      const { error } = await supabase
        .from("pricing_v2_procedures")
        .update({ name: data.name, execution_time: data.execution_time, desired_price: data.desired_price, quantity: data.quantity ?? 1 })
        .eq("id", id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: mapDatabaseError(error), variant: "destructive" });
        return false;
      }
      await supabase.from("pricing_v2_procedure_items").delete().eq("procedure_id", id);
      if (data.items.length > 0) {
        await supabase.from("pricing_v2_procedure_items").insert(
          data.items.map((i) => ({ procedure_id: id, description: i.description, value: i.value, unit_type: i.unit_type ?? "sessao" }))
        );
      }
      toast({ title: "Procedimento atualizado!" });
      await fetchProcedures();
      return true;
    } finally {
      updatingProcRef.current.delete(id);
    }
  };

  const duplicateProcedure = async (id: string) => {
    const proc = procedures.find((p) => p.id === id);
    if (!proc || !user) return false;
    const { data: newProc, error } = await supabase
      .from("pricing_v2_procedures")
      .insert({ name: `${proc.name} (cópia)`, execution_time: proc.execution_time, desired_price: proc.desired_price, quantity: proc.quantity ?? 1, user_id: effectiveUserId, company_id: selectedCompanyId || null })
      .select()
      .single();
    if (error || !newProc) return false;
    if (proc.items.length > 0) {
      await supabase.from("pricing_v2_procedure_items").insert(
        proc.items.map((i) => ({ procedure_id: newProc.id, description: i.description, value: i.value, unit_type: i.unit_type ?? "sessao" }))
      );
    }
    toast({ title: "Procedimento duplicado!" });
    await fetchProcedures();
    return true;
  };

  const deleteProcedure = async (id: string) => {
    await supabase.from("pricing_v2_procedure_items").delete().eq("procedure_id", id);
    const { error } = await supabase.from("pricing_v2_procedures").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: mapDatabaseError(error), variant: "destructive" });
      return false;
    }
    if (selectedProcedureId === id) setSelectedProcedureId(null);
    toast({ title: "Procedimento excluído!" });
    await fetchProcedures();
    return true;
  };

  // ─── Calc for procedure (source of truth — uses custoHoraPorSala) ───
  const calcParts = (input: { execution_time: number; quantity: number; items: { value: number; unit_type: ItemUnitType }[] }) => {
    const qty = Math.max(1, input.quantity ?? 1);
    const cf = custoHoraPorSala * (input.execution_time || 0);
    const cv = input.items.reduce((s, i) => s + (i.unit_type === "unitario" ? i.value * qty : i.value), 0);
    return { qty, cf, cv };
  };

  /** Reverse calc: price that yields the target profit margin (%) */
  const suggestPrice = (parts: { cf: number; cv: number }, targetMarginPct: number) => {
    const divisor = 1 - targetMarginPct / 100 - taxRate / 100;
    if (divisor <= 0) return null;
    return (parts.cf + parts.cv) / divisor;
  };

  const calcFrom = (input: { execution_time: number; quantity: number; desired_price: number; items: { value: number; unit_type: ItemUnitType }[] }) => {
    const { qty, cf, cv } = calcParts(input);
    const nf = input.desired_price * (taxRate / 100);
    const liquido = input.desired_price - cf - cv - nf;
    const lucro = liquido;
    const lucratividadeHora = input.execution_time > 0 ? lucro / input.execution_time : 0;
    const lucratividadePct = input.desired_price > 0 ? (lucro / input.desired_price) * 100 : 0;
    return { qty, cf, cv, nf, liquido, lucro, lucratividadeHora, lucratividadePct };
  };

  const calcProcedure = (proc: ProcedureV2) => calcFrom(proc);


  // ─── Init ───
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchConfig();
      await fetchCostItems();
      await fetchProcedures();
      setLoading(false);
    };
    init();
  }, [fetchConfig, fetchCostItems, fetchProcedures]);

  // ─── Inline update (local + simple DB, no delete/re-insert) ───
  const inlineDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const inlineUpdateProcedure = (id: string, data: { desired_price?: number; execution_time?: number; quantity?: number }) => {
    // 1. Update local state immediately
    setProcedures((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              desired_price: data.desired_price ?? p.desired_price,
              execution_time: data.execution_time ?? p.execution_time,
              quantity: data.quantity ?? p.quantity,
            }
          : p
      )
    );

    // 2. Debounce DB persistence
    if (inlineDebounceRef.current[id]) {
      clearTimeout(inlineDebounceRef.current[id]);
    }
    inlineDebounceRef.current[id] = setTimeout(async () => {
      delete inlineDebounceRef.current[id];
      const updatePayload: Record<string, number> = {};
      if (data.desired_price !== undefined) updatePayload.desired_price = data.desired_price;
      if (data.execution_time !== undefined) updatePayload.execution_time = data.execution_time;
      if (data.quantity !== undefined) updatePayload.quantity = Math.max(1, Math.round(data.quantity));

      const { error } = await supabase
        .from("pricing_v2_procedures")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        toast({ title: "Erro ao salvar", description: mapDatabaseError(error), variant: "destructive" });
      }
    }, 800);
  };

  const selectedProcedure = procedures.find((p) => p.id === selectedProcedureId) ?? null;

  return {
    config,
    costItems,
    procedures,
    loading,
    groupTotals,
    custoHora,
    fmm,
    fmmPorSala,
    custoHoraPorSala,
    hoursPerMonth,
    numRooms,
    taxRate,
    selectedProcedure,
    selectedProcedureId,
    setSelectedProcedureId,
    saveConfig,
    addCostItem,
    updateCostItem,
    deleteCostItem,
    createProcedure,
    updateProcedure,
    duplicateProcedure,
    deleteProcedure,
    calcProcedure,
    calcParts,
    calcFrom,
    suggestPrice,

    inlineUpdateProcedure,
    refetch: async () => {
      await fetchConfig();
      await fetchCostItems();
      await fetchProcedures();
    },
  };
}
