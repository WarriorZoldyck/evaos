import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProcedureV2, CostItem, CostGroupTotals } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  procedures: ProcedureV2[];
  costItems: CostItem[];
  groupTotals: CostGroupTotals;
  custoHora: number;
  fmm: number;
  taxRate: number;
  hoursPerMonth: number;
  numRooms: number;
  calcProcedure: (proc: ProcedureV2) => {
    cf: number; cv: number; nf: number; liquido: number; lucro: number;
    lucratividadeHora: number; lucratividadePct: number;
  };
}

function monthlyVal(item: CostItem) {
  return item.frequency === "A" ? item.value / 12 : item.value;
}

const GROUP_LABELS: Record<string, string> = {
  fixos_clinica: "Fixos Clínica",
  variaveis_clinica: "Variáveis Clínica",
  pessoais: "Pessoais (Casa)",
};

export function ExportPricingButton({
  procedures, costItems, groupTotals, custoHora, fmm, taxRate, hoursPerMonth, numRooms, calcProcedure,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      // Build CSV content
      const lines: string[] = [];
      const addLine = (...cols: (string | number)[]) => lines.push(cols.map(c => `"${c}"`).join(","));

      addLine("RELATÓRIO DE PRECIFICAÇÃO - FHC");
      addLine("");
      addLine("CONFIGURAÇÃO");
      addLine("Horas/Mês", hoursPerMonth);
      addLine("Salas", numRooms);
      addLine("Alíquota IR (%)", taxRate);
      addLine("");

      addLine("RESUMO DE CUSTOS");
      addLine("Grupo", "Total Mensal");
      addLine("Fixos Clínica", fmt(groupTotals.fixos_clinica));
      addLine("Variáveis Clínica", fmt(groupTotals.variaveis_clinica));
      addLine("Pessoais (Casa)", fmt(groupTotals.pessoais));
      addLine("TOTAL", fmt(groupTotals.total));
      addLine("");
      addLine("Custo/Hora", fmt(custoHora));
      addLine("FMM", fmt(fmm));
      addLine("");

      // Cost items detail
      addLine("DETALHAMENTO DE DESPESAS");
      addLine("Grupo", "Categoria", "Descrição", "Valor", "Freq.", "Mensal");
      for (const item of costItems) {
        addLine(
          GROUP_LABELS[item.cost_group] || item.cost_group,
          item.category,
          item.description,
          item.value,
          item.frequency,
          monthlyVal(item).toFixed(2)
        );
      }
      addLine("");

      // Procedures
      addLine("PROCEDIMENTOS");
      addLine("Nome", "Qtd", "Tempo (h)", "Preço", "CF", "CV", "NF", "Lucro", "Lucro/h", "Lucro %");
      for (const proc of procedures) {
        const calc = calcProcedure(proc);
        addLine(
          proc.name,
          proc.quantity ?? 1,
          proc.execution_time,
          proc.desired_price.toFixed(2),
          calc.cf.toFixed(2),
          calc.cv.toFixed(2),
          calc.nf.toFixed(2),
          calc.lucro.toFixed(2),
          calc.lucratividadeHora.toFixed(2),
          calc.lucratividadePct.toFixed(1) + "%"
        );
      }

      const csvContent = "\uFEFF" + lines.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `precificacao_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: "Relatório exportado!", description: "Arquivo CSV baixado com sucesso." });
    } catch (err) {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
    setExporting(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1">
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
      Exportar CSV
    </Button>
  );
}
