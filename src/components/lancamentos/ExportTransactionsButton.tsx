import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import type { Transaction, TransactionFilters, Category, CreditCard } from "@/hooks/useTransactions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  filters: TransactionFilters;
  categories: Category[];
  allCategories: Category[];
  creditCards: CreditCard[];
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export function ExportTransactionsButton({
  filters, allCategories, creditCards, bankAccounts, wallets, suppliers, clients,
}: Props) {
  const { user } = useAuth();
  const { selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const accountName = (t: Transaction) => {
    if (t.bank_account_id) return bankAccounts.find((a) => a.id === t.bank_account_id)?.name || "—";
    if (t.wallet_id) return wallets.find((w) => w.id === t.wallet_id)?.name || "—";
    if (t.credit_card_id) return creditCards.find((c) => c.id === t.credit_card_id)?.name || "—";
    return "—";
  };

  const categoryName = (t: Transaction) => {
    const cat = allCategories.find((c) => c.id === t.category || c.name === t.category);
    return cat?.name || t.category || "—";
  };

  const contactName = (t: Transaction) => {
    if (t.supplier_id) return suppliers.find((s) => s.id === t.supplier_id)?.name || t.contact_name || "—";
    if (t.client_id) return clients.find((c) => c.id === t.client_id)?.name || t.contact_name || "—";
    return t.contact_name || "—";
  };

  const fetchAll = async (): Promise<Transaction[]> => {
    if (!user) return [];

    let query = supabase.from("transactions").select("*");
    if (isPersonal) query = query.is("company_id", null);
    else if (selectedCompanyId) query = query.eq("company_id", selectedCompanyId);

    if (filters.type !== "todos") query = query.eq("type", filters.type);
    if (filters.status !== "todos") query = query.eq("status", filters.status);
    if (filters.search.trim()) {
      const s = filters.search.trim();
      query = query.or(`description.ilike.%${s}%,contact_name.ilike.%${s}%`);
    }
    if (filters.categoryId === "__sem_categoria__") {
      query = query.or("category.is.null,category.eq.");
    } else if (filters.categoryId) {
      const selectedCat = allCategories.find((c) => c.id === filters.categoryId);
      const childCats = allCategories.filter((c) => c.parent_id === filters.categoryId);
      const allIds = [filters.categoryId, ...childCats.map((c) => c.id)];
      const allNames = [selectedCat?.name, ...childCats.map((c) => c.name)].filter(Boolean);
      const conditions = [
        ...allIds.map((id) => `category.eq.${id}`),
        ...allNames.map((name) => `category.eq.${name}`),
      ];
      query = query.or(conditions.join(","));
    }
    if (filters.dateFrom) query = query.gte("payment_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("payment_date", filters.dateTo);
    if (filters.accountId) {
      const [accType, ...idParts] = filters.accountId.split(":");
      const accId = idParts.join(":");
      if (accType === "bank") query = query.eq("bank_account_id", accId);
      else if (accType === "wallet") query = query.eq("wallet_id", accId);
      else if (accType === "card") {
        const children = creditCards.filter((c) => c.parent_card_id === accId);
        if (children.length > 0) query = query.in("credit_card_id", [accId, ...children.map((c) => c.id)]);
        else query = query.eq("credit_card_id", accId);
      }
    }
    if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
    if (filters.clientId) query = query.eq("client_id", filters.clientId);

    const ascending = filters.sortOrder === "asc";
    query = query.order("payment_date", { ascending }).order("created_at", { ascending });

    // Paginate to bypass 1000-row Supabase limit
    const all: Transaction[] = [];
    const batch = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await query.range(offset, offset + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...(data as Transaction[]));
      if (data.length < batch) break;
      offset += batch;
      if (offset > 50000) break; // safety
    }
    return all;
  };

  const buildRows = (txs: Transaction[]) =>
    txs.map((t) => ({
      data: fmtDate(t.payment_date),
      competencia: fmtDate(t.competence_date),
      descricao: t.description,
      contato: contactName(t),
      categoria: categoryName(t),
      conta: accountName(t),
      tipo: t.type === "receita" ? "Receita" : "Despesa",
      status: t.status,
      valor: Number(t.amount),
      valorFmt: fmtBRL(Number(t.amount)),
      sign: t.type === "receita" ? 1 : -1,
    }));

  const exportCSV = async () => {
    setLoading(true);
    try {
      const txs = await fetchAll();
      if (txs.length === 0) {
        toast({ title: "Nenhum lançamento para exportar" });
        return;
      }
      const rows = buildRows(txs);
      const header = ["Data", "Competência", "Descrição", "Contato", "Categoria", "Conta", "Tipo", "Status", "Valor"];
      const escape = (v: any) => {
        const s = String(v ?? "");
        return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [
        header.join(";"),
        ...rows.map((r) =>
          [r.data, r.competencia, r.descricao, r.contato, r.categoria, r.conta, r.tipo, r.status, r.valor.toFixed(2).replace(".", ",")]
            .map(escape)
            .join(";")
        ),
      ].join("\n");
      // BOM for Excel compatibility
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lancamentos_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${txs.length} lançamentos exportados` });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    setLoading(true);
    try {
      const txs = await fetchAll();
      if (txs.length === 0) {
        toast({ title: "Nenhum lançamento para exportar" });
        return;
      }
      const rows = buildRows(txs);
      const totalReceita = rows.filter((r) => r.sign > 0).reduce((s, r) => s + r.valor, 0);
      const totalDespesa = rows.filter((r) => r.sign < 0).reduce((s, r) => s + r.valor, 0);
      const saldo = totalReceita - totalDespesa;

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Lançamentos", 40, 40);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const periodo =
        filters.dateFrom && filters.dateTo
          ? `Período: ${fmtDate(filters.dateFrom)} a ${fmtDate(filters.dateTo)}`
          : "Período: todos";
      doc.text(periodo, 40, 58);
      doc.text(`Contexto: ${isPersonal ? "Pessoal" : "Empresa"}`, 40, 72);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 40, 86);

      autoTable(doc, {
        startY: 100,
        head: [["Data", "Descrição", "Contato", "Categoria", "Conta", "Tipo", "Status", "Valor"]],
        body: rows.map((r) => [
          r.data, r.descricao, r.contato, r.categoria, r.conta, r.tipo, r.status, r.valorFmt,
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [11, 17, 32], textColor: 255 },
        columnStyles: {
          7: { halign: "right" },
          5: { halign: "center" },
          6: { halign: "center" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 7) {
            const r = rows[data.row.index];
            data.cell.styles.textColor = r.sign > 0 ? [0, 128, 0] : [200, 0, 0];
          }
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Receitas: ${fmtBRL(totalReceita)}`, 40, finalY + 24);
      doc.text(`Total Despesas: ${fmtBRL(totalDespesa)}`, 40, finalY + 40);
      doc.text(`Saldo: ${fmtBRL(saldo)}`, 40, finalY + 56);

      // Page numbers
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 80, doc.internal.pageSize.getHeight() - 20);
      }

      doc.save(`lancamentos_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: `${txs.length} lançamentos exportados` });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV} disabled={loading}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPDF} disabled={loading}>
          <FileText className="h-4 w-4 mr-2" /> Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
