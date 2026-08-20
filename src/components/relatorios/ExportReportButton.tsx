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
import type { DRECategoryRow, DRESection } from "@/hooks/useDREData";
import { getPeriodLabel } from "@/hooks/useDREData";

export interface ExportRow {
  label: string;
  level: number;
  values: number[];
  total: number;
  bold?: boolean;
}

interface Props {
  title: string;
  fileBaseName: string;
  periods: string[];
  rows: ExportRow[];
  disabled?: boolean;
}

const num = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const indent = (row: ExportRow) => `${"    ".repeat(row.level)}${row.label}`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Flattens a DRE/cash-flow category tree into export rows. */
export function flattenCategoryRows(
  rows: DRECategoryRow[],
  periods: string[],
  level = 0,
): ExportRow[] {
  return rows.flatMap((r) => {
    const values = periods.map((p) => r.monthlyTotals[p] ?? 0);
    const self: ExportRow = {
      label: r.categoryName,
      level,
      values,
      total: values.reduce((a, b) => a + b, 0),
    };
    return [self, ...flattenCategoryRows(r.children ?? [], periods, level + 1)];
  });
}

/** Builds export rows for the accounting DRE (sections + their categories). */
export function buildContabilRows(sections: DRESection[], periods: string[]): ExportRow[] {
  return sections.flatMap((s) => {
    const values = periods.map((p) => s.monthlyTotals[p] ?? 0);
    const head: ExportRow = {
      label: s.sign === "=" ? s.label : `(${s.sign}) ${s.label}`,
      level: 0,
      values,
      total: values.reduce((a, b) => a + b, 0),
      bold: true,
    };
    return [head, ...flattenCategoryRows(s.categoryRows ?? [], periods, 1)];
  });
}

/** Builds export rows for the managerial view (revenues, expenses, result). */
export function buildGerencialRows(
  periods: string[],
  revenueRows: DRECategoryRow[],
  expenseRows: DRECategoryRow[],
  revenueTotals: Record<string, number>,
  expenseTotals: Record<string, number>,
  results: Record<string, number>,
): ExportRow[] {
  const totalRow = (label: string, map: Record<string, number>): ExportRow => {
    const values = periods.map((p) => map[p] ?? 0);
    return { label, level: 0, values, total: values.reduce((a, b) => a + b, 0), bold: true };
  };
  return [
    totalRow("RECEITAS", revenueTotals),
    ...flattenCategoryRows(revenueRows, periods, 1),
    totalRow("DESPESAS", expenseTotals),
    ...flattenCategoryRows(expenseRows, periods, 1),
    totalRow("RESULTADO", results),
  ];
}

export function ExportReportButton({ title, fileBaseName, periods, rows, disabled }: Props) {
  const [exporting, setExporting] = useState<null | "csv" | "pdf" | "xlsx">(null);
  const { toast } = useToast();

  const headers = ["Descrição", ...periods.map(getPeriodLabel), "Total"];
  const stamp = () => new Date().toISOString().slice(0, 10);
  const matrix = () => rows.map((r) => [indent(r), ...r.values.map(num), num(r.total)]);

  const exportCsv = () => {
    const all = [headers, ...matrix()];
    const csv =
      "\uFEFF" +
      all.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${fileBaseName}_${stamp()}.csv`);
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString("pt-BR"), 14, 21);
    autoTable(doc, {
      head: [headers],
      body: matrix(),
      startY: 26,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 55, halign: "left" } },
      didParseCell: (data) => {
        if (data.section === "body" && rows[data.row.index]?.bold) {
          data.cell.styles.fontStyle = "bold";
        }
        if (data.section === "body" && data.column.index > 0) {
          data.cell.styles.halign = "right";
        }
      },
    });
    doc.save(`${fileBaseName}_${stamp()}.pdf`);
  };

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const aoa = [
      headers,
      ...rows.map((r) => [indent(r), ...r.values.map((v) => Number(v.toFixed(2))), Number(r.total.toFixed(2))]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 40 }, ...periods.map(() => ({ wch: 14 })), { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 28));
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${fileBaseName}_${stamp()}.xlsx`,
    );
  };

  const handleExport = async (format: "csv" | "pdf" | "xlsx") => {
    if (!rows.length) {
      toast({ title: "Nada para exportar", variant: "destructive" });
      return;
    }
    setExporting(format);
    try {
      if (format === "csv") exportCsv();
      else if (format === "pdf") await exportPdf();
      else await exportXlsx();
      toast({ title: "Relatório exportado!", description: `Arquivo ${format.toUpperCase()} baixado com sucesso.` });
    } catch (err) {
      console.error("Export error", err);
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
    setExporting(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !!exporting} className="gap-1 h-8 text-xs">
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
