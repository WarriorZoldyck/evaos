import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface PricingConfig {
  id: string;
  user_id: string | null;
  hours_per_month: number;
  profit_margin: number;
  matrix_values: MatrixValues;
  updated_at: string | null;
}

export interface MatrixValues {
  fixos_clinica: string[];
  pessoais: string[];
}

export interface ProcedureItem {
  id: string;
  procedure_id: string | null;
  description: string;
  value: number;
}

export interface Procedure {
  id: string;
  user_id: string | null;
  name: string;
  execution_time: number;
  desired_price: number;
  created_at: string | null;
  items: ProcedureItem[];
}

export interface CostSummary {
  totalFixosClinica: number;
  totalPessoais: number;
  custoHora: number;
}

const DEFAULT_MATRIX: MatrixValues = {
  fixos_clinica: ["Prediais", "Salários", "Administrativos", "Outros"],
  pessoais: ["Educação", "Moradia", "Lazer", "Planejamento", "Vestuário", "Alimentação", "Transporte", "Saúde"],
};

function parseMatrixValues(json: Json | null): MatrixValues {
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ...DEFAULT_MATRIX };
  const obj = json as Record<string, Json | undefined>;
  return {
    fixos_clinica: Array.isArray(obj.fixos_clinica) ? (obj.fixos_clinica as string[]) : DEFAULT_MATRIX.fixos_clinica,
    pessoais: Array.isArray(obj.pessoais) ? (obj.pessoais as string[]) : DEFAULT_MATRIX.pessoais,
  };
}

export function usePricing() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary>({ totalFixosClinica: 0, totalPessoais: 0, custoHora: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null);

  // ─── Fetch config ───
  const fetchConfig = useCallback(async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("pricing_configurations")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      toast({ title: "Erro ao carregar configuração", description: error.message, variant: "destructive" });
      return null;
    }

    if (data) {
      const parsed: PricingConfig = {
        ...data,
        hours_per_month: data.hours_per_month ?? 160,
        profit_margin: data.profit_margin ?? 30,
        matrix_values: parseMatrixValues(data.matrix_values),
      };
      setConfig(parsed);
      return parsed;
    }
    return null;
  }, [user, toast]);

  // ─── Save config ───
  const saveConfig = async (hours: number, margin: number, matrix?: MatrixValues) => {
    if (!user) return false;
    const matrixToSave = matrix ?? config?.matrix_values ?? DEFAULT_MATRIX;

    if (config) {
      const { error } = await supabase
        .from("pricing_configurations")
        .update({
          hours_per_month: hours,
          profit_margin: margin,
          matrix_values: matrixToSave as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return false;
      }
    } else {
      const { error } = await supabase.from("pricing_configurations").insert({
        user_id: user.id,
        hours_per_month: hours,
        profit_margin: margin,
        matrix_values: matrixToSave as unknown as Json,
      });

      if (error) {
        toast({ title: "Erro ao criar configuração", description: error.message, variant: "destructive" });
        return false;
      }
    }

    toast({ title: "Configuração salva!" });
    await fetchConfig();
    await fetchCosts(hours);
    return true;
  };

  // ─── Fetch real costs from transactions ───
  const fetchCosts = useCallback(
    async (hoursPerMonth?: number) => {
      if (!user) return;
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const { data, error } = await supabase
        .from("transactions")
        .select("amount, category")
        .eq("type", "despesa")
        .eq("status", "Pago")
        .gte("payment_date", twelveMonthsAgo.toISOString().split("T")[0]);

      if (error) {
        console.error("Error fetching costs:", error);
        return;
      }

      const currentConfig = config;
      const matrix = currentConfig?.matrix_values ?? DEFAULT_MATRIX;
      const hours = hoursPerMonth ?? currentConfig?.hours_per_month ?? 160;

      let totalFixos = 0;
      let totalPessoais = 0;

      (data || []).forEach((tx) => {
        const cat = (tx.category || "").toLowerCase();
        if (matrix.fixos_clinica.some((c) => cat.includes(c.toLowerCase()))) {
          totalFixos += Number(tx.amount) || 0;
        } else if (matrix.pessoais.some((c) => cat.includes(c.toLowerCase()))) {
          totalPessoais += Number(tx.amount) || 0;
        }
      });

      // Average monthly
      const monthlyFixos = totalFixos / 12;
      const monthlyPessoais = totalPessoais / 12;
      const custoHora = hours > 0 ? (monthlyFixos + monthlyPessoais) / hours : 0;

      setCostSummary({
        totalFixosClinica: monthlyFixos,
        totalPessoais: monthlyPessoais,
        custoHora,
      });
    },
    [user, config]
  );

  // ─── Fetch procedures with items ───
  const fetchProcedures = useCallback(async () => {
    if (!user) return;
    const { data: procs, error } = await supabase
      .from("pricing_procedures")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      toast({ title: "Erro ao carregar procedimentos", description: error.message, variant: "destructive" });
      return;
    }

    if (!procs || procs.length === 0) {
      setProcedures([]);
      return;
    }

    const procIds = procs.map((p) => p.id);
    const { data: items } = await supabase
      .from("pricing_procedure_items")
      .select("*")
      .in("procedure_id", procIds);

    const mapped: Procedure[] = procs.map((p) => ({
      ...p,
      execution_time: p.execution_time ?? 1,
      desired_price: p.desired_price ?? 0,
      items: (items || [])
        .filter((i) => i.procedure_id === p.id)
        .map((i) => ({ ...i, value: i.value ?? 0 })),
    }));

    setProcedures(mapped);
  }, [user, toast]);

  // ─── Create procedure ───
  const createProcedure = async (data: {
    name: string;
    execution_time: number;
    desired_price: number;
    items: { description: string; value: number }[];
  }) => {
    if (!user) return false;

    const { data: proc, error } = await supabase
      .from("pricing_procedures")
      .insert({ name: data.name, execution_time: data.execution_time, desired_price: data.desired_price, user_id: user.id })
      .select()
      .single();

    if (error || !proc) {
      toast({ title: "Erro ao criar procedimento", description: error?.message, variant: "destructive" });
      return false;
    }

    if (data.items.length > 0) {
      const { error: itemsError } = await supabase.from("pricing_procedure_items").insert(
        data.items.map((i) => ({ procedure_id: proc.id, description: i.description, value: i.value }))
      );
      if (itemsError) {
        toast({ title: "Erro ao salvar itens", description: itemsError.message, variant: "destructive" });
      }
    }

    toast({ title: "Procedimento criado!" });
    await fetchProcedures();
    return true;
  };

  // ─── Update procedure ───
  const updateProcedure = async (
    id: string,
    data: {
      name: string;
      execution_time: number;
      desired_price: number;
      items: { description: string; value: number }[];
    }
  ) => {
    const { error } = await supabase
      .from("pricing_procedures")
      .update({ name: data.name, execution_time: data.execution_time, desired_price: data.desired_price })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }

    // Replace items: delete old, insert new
    await supabase.from("pricing_procedure_items").delete().eq("procedure_id", id);

    if (data.items.length > 0) {
      await supabase.from("pricing_procedure_items").insert(
        data.items.map((i) => ({ procedure_id: id, description: i.description, value: i.value }))
      );
    }

    toast({ title: "Procedimento atualizado!" });
    await fetchProcedures();
    return true;
  };

  // ─── Duplicate procedure ───
  const duplicateProcedure = async (id: string) => {
    const proc = procedures.find((p) => p.id === id);
    if (!proc || !user) return false;

    const { data: newProc, error } = await supabase
      .from("pricing_procedures")
      .insert({
        name: `${proc.name} (cópia)`,
        execution_time: proc.execution_time,
        desired_price: proc.desired_price,
        user_id: user.id,
      })
      .select()
      .single();

    if (error || !newProc) {
      toast({ title: "Erro ao duplicar", description: error?.message, variant: "destructive" });
      return false;
    }

    if (proc.items.length > 0) {
      await supabase.from("pricing_procedure_items").insert(
        proc.items.map((i) => ({ procedure_id: newProc.id, description: i.description, value: i.value }))
      );
    }

    toast({ title: "Procedimento duplicado!" });
    await fetchProcedures();
    return true;
  };

  // ─── Delete procedure ───
  const deleteProcedure = async (id: string) => {
    await supabase.from("pricing_procedure_items").delete().eq("procedure_id", id);
    const { error } = await supabase.from("pricing_procedures").delete().eq("id", id);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }

    if (selectedProcedureId === id) setSelectedProcedureId(null);
    toast({ title: "Procedimento excluído!" });
    await fetchProcedures();
    return true;
  };

  // ─── Calculate price for a procedure ───
  const calcPrice = (proc: Procedure) => {
    const margin = (config?.profit_margin ?? 30) / 100;
    const custoFixoProporcional = costSummary.custoHora * proc.execution_time;
    const custosVariaveis = proc.items.reduce((sum, i) => sum + i.value, 0);
    const subtotal = custoFixoProporcional + custosVariaveis;
    const margemValor = subtotal * margin;
    const precoSugerido = subtotal + margemValor;

    return { custoFixoProporcional, custosVariaveis, subtotal, margemValor, precoSugerido };
  };

  // ─── Init ───
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const cfg = await fetchConfig();
      await fetchCosts(cfg?.hours_per_month);
      await fetchProcedures();
      setLoading(false);
    };
    init();
  }, [fetchConfig, fetchCosts, fetchProcedures]);

  const selectedProcedure = procedures.find((p) => p.id === selectedProcedureId) ?? null;

  return {
    config,
    costSummary,
    procedures,
    loading,
    selectedProcedure,
    selectedProcedureId,
    setSelectedProcedureId,
    saveConfig,
    createProcedure,
    updateProcedure,
    duplicateProcedure,
    deleteProcedure,
    calcPrice,
    refetch: async () => {
      await fetchConfig();
      await fetchCosts();
      await fetchProcedures();
    },
  };
}
