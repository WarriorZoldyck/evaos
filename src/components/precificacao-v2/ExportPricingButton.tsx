import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2, Table2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

interface Props {
  procedures: ProcedureV2[];
  calcProcedure: (proc: ProcedureV2) => {
    cf: number; cv: number; nf: number; liquido: number; lucro: number;
    lucratividadeHora: number; lucratividadePct: number;
  };
}

const HEADERS = [
  "Nome", "Qtd", "Tempo (h)", "Lucratividade %", "Preço",
  "CF", "CV", "NF", "Lucro", "Lucro/h",
];

const num = (v: number, d = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportPricingButton({ procedures, calcProcedure }: Props) {
  const [exporting, setExporting] = useState<null | "csv" | "pdf" | "xlsx">(null);
  const { toast } = useToast();

  const buildRows = (): (string | number)[][] =>
    procedures.map((proc) => {
      const calc = calcProcedure(proc);
      return [
        proc.name,
        proc.quantity ?? 1,
        num(proc.execution_time, 2),
        num(calc.lucratividadePct, 1) + "%",
        num(proc.desired_price),
        num(calc.cf),
        num(calc.cv),
        num(calc.nf),
        num(calc.lucro),
        num(calc.lucratividadeHora),
      ];
    });

  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportCsv = () => {
    const rows = [HEADERS, ...buildRows()];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `procedimentos_${stamp()}.csv`);
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Procedimentos — Precificação", 14, 15);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString("pt-BR"), 14, 21);
    autoTable(doc, {
      head: [HEADERS],
      body: buildRows().map((r) => r.map(String)),
      startY: 26,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 55 } },
    });
    doc.save(`procedimentos_${stamp()}.pdf`);
  };

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const rows = procedures.map((proc) => {
      const calc = calcProcedure(proc);
      return {
        Nome: proc.name,
        Qtd: proc.quantity ?? 1,
        "Tempo (h)": Number(proc.execution_time),
        "Lucratividade %": Number(calc.lucratividadePct.toFixed(1)),
        "Preço": Number(proc.desired_price.toFixed(2)),
        CF: Number(calc.cf.toFixed(2)),
        CV: Number(calc.cv.toFixed(2)),
        NF: Number(calc.nf.toFixed(2)),
        Lucro: Number(calc.lucro.toFixed(2)),
        "Lucro/h": Number(calc.lucratividadeHora.toFixed(2)),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
    ws["!cols"] = [{ wch: 34 }, { wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Procedimentos");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `procedimentos_${stamp()}.xlsx`,
    );
  };

  const handleExport = async (format: "csv" | "pdf" | "xlsx") => {
    if (!procedures.length) {
      toast({ title: "Nenhum procedimento para exportar", variant: "destructive" });
      return;
    }
    setExporting(format);
    try {
      if (format === "csv") exportCsv();
      else if (format === "pdf") await exportPdf();
      else await exportXlsx();
      toast({ title: "Procedimentos exportados!", description: `Arquivo ${format.toUpperCase()} baixado com sucesso.` });
    } catch (err) {
      console.error("Export error", err);
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
    setExporting(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!!exporting} className="gap-1">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover z-50">
        <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
          <Table2 className="h-4 w-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2">
          <FileText className="h-4 w-4" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
