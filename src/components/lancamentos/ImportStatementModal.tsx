import { useState, useRef } from "react";
import { format } from "date-fns";
import { Upload, FileText, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransactionInsert } from "@/hooks/useTransactions";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  selected: boolean;
}

interface ImportStatementModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: TransactionInsert[]) => Promise<boolean>;
  bankAccounts: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  creditCards: { id: string; name: string; last_four_digits: string | null }[];
  categories: { id: string; name: string; parent_id: string | null; type: string | null }[];
}

export function ImportStatementModal({
  open,
  onClose,
  onImport,
  bankAccounts,
  wallets,
  categories,
}: ImportStatementModalProps) {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState("");
  const [targetAccount, setTargetAccount] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");

  const rootCategories = categories.filter((c) => !c.parent_id);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    setRows([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-bank-statement`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Erro ao processar arquivo",
          description: result.error || "Erro desconhecido",
          variant: "destructive",
        });
        setParsing(false);
        return;
      }

      setRows(
        (result.transactions || []).map((t: any) => ({
          ...t,
          selected: true,
        }))
      );

      toast({
        title: `${result.count} transações encontradas`,
        description: `Revise antes de importar.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    }

    setParsing(false);
  };

  const toggleRow = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const selectedRows = rows.filter((r) => r.selected);

  const handleImport = async () => {
    if (!user) return;
    if (!targetAccount) {
      toast({ title: "Selecione a conta destino", variant: "destructive" });
      return;
    }

    setImporting(true);

    const [accType, ...idParts] = targetAccount.split(":");
    const accId = idParts.join(":");

    const transactions: TransactionInsert[] = selectedRows.map((r) => ({
      description: r.description,
      amount: r.amount,
      type: r.type,
      payment_date: r.date,
      competence_date: r.date,
      status: "Pago" as const,
      category: defaultCategory || "Sem Categoria",
      user_id: user.id,
      company_id: selectedCompanyId || null,
      bank_account_id: accType === "bank" ? accId : null,
      wallet_id: accType === "wallet" ? accId : null,
      external_id: `import_${r.date}_${r.amount}_${r.description.slice(0, 20)}`,
    }));

    const success = await onImport(transactions);
    setImporting(false);

    if (success) {
      setRows([]);
      setFileName("");
      onClose();
    }
  };

  const handleClose = () => {
    setRows([]);
    setFileName("");
    setTargetAccount("");
    setDefaultCategory("");
    onClose();
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Extrato Bancário
            <Badge variant="secondary" className="text-[10px]">Beta</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Upload area */}
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="border-2 border-dashed rounded-lg p-8 text-center w-full cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}>
              {parsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                </div>
              ) : (
                <>
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Clique para selecionar um arquivo</p>
                   <p className="text-xs text-muted-foreground mt-1">
                     Formatos aceitos: OFX, CSV, TXT, PDF
                   </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".ofx,.qfx,.csv,.txt,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3 items-end">
              {/* Account select */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Conta destino *</label>
                <Select value={targetAccount} onValueChange={setTargetAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => (
                      <SelectItem key={`bank:${a.id}`} value={`bank:${a.id}`}>
                        🏦 {a.name}
                      </SelectItem>
                    ))}
                    {wallets.map((w) => (
                      <SelectItem key={`wallet:${w.id}`} value={`wallet:${w.id}`}>
                        👛 {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Default category */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Categoria padrão</label>
                <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {rootCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {fileName} — {selectedRows.length} de {rows.length} selecionadas
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 w-10">
                      <Checkbox
                        checked={selectedRows.length === rows.length}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </th>
                    <th className="p-2 text-left font-medium">Data</th>
                    <th className="p-2 text-left font-medium">Descrição</th>
                    <th className="p-2 text-right font-medium">Valor</th>
                    <th className="p-2 text-center font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className={`border-b border-border/50 ${!r.selected ? "opacity-40" : ""}`}>
                      <td className="p-2">
                        <Checkbox checked={r.selected} onCheckedChange={() => toggleRow(idx)} />
                      </td>
                      <td className="p-2 text-muted-foreground whitespace-nowrap">{r.date}</td>
                      <td className="p-2 max-w-[300px] truncate">{r.description}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(r.amount)}</td>
                      <td className="p-2 text-center">
                        <Badge variant={r.type === "receita" ? "default" : "destructive"} className="text-[10px]">
                          {r.type === "receita" ? "Entrada" : "Saída"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {rows.length > 0 && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || selectedRows.length === 0 || !targetAccount}
              className="gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Importar {selectedRows.length} transações
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
