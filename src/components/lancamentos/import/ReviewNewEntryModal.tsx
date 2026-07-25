import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CategoryPathCombobox } from "@/components/lancamentos/CategoryPathCombobox";
import { ContactSelectWithCreate } from "@/components/lancamentos/ContactSelectWithCreate";
import type { RowCategoryValue } from "./ReconcileStep";

interface ReviewNewEntryModalProps {
  open: boolean;
  onClose: () => void;
  row: { date: string; description: string; amount: number; type: "receita" | "despesa" } | null;
  rawDescription: string;
  initialDescription: string;
  initialCategory: RowCategoryValue;
  initialContact: { supplier_id?: string | null; client_id?: string | null };
  categories: { id: string; name: string; parent_id: string | null; type: string | null }[];
  suppliers: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  onCreateCategory?: (params: { name: string; parentName?: string; type?: "receita" | "despesa" }) => Promise<{ id: string; name: string } | null>;
  onContactCreated?: (type: "supplier" | "client", id: string, name: string) => void;
  onConfirm: (result: {
    description: string;
    category: RowCategoryValue;
    contact: { supplier_id?: string | null; client_id?: string | null };
  }) => void;
}

const fmtDate = (iso: string) => {
  const [y, m, d] = (iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};
const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ReviewNewEntryModal({
  open,
  onClose,
  row,
  rawDescription,
  initialDescription,
  initialCategory,
  initialContact,
  categories,
  suppliers,
  clients,
  onCreateCategory,
  onContactCreated,
  onConfirm,
}: ReviewNewEntryModalProps) {
  const [description, setDescription] = useState(initialDescription || rawDescription);
  const [category, setCategory] = useState<RowCategoryValue>(initialCategory || { category: "" });
  const [supplierId, setSupplierId] = useState<string>(initialContact?.supplier_id || "");
  const [clientId, setClientId] = useState<string>(initialContact?.client_id || "");

  useEffect(() => {
    if (!open) return;
    setDescription(initialDescription || rawDescription);
    setCategory(initialCategory || { category: "" });
    setSupplierId(initialContact?.supplier_id || "");
    setClientId(initialContact?.client_id || "");
  }, [open, initialDescription, rawDescription, initialCategory, initialContact]);

  if (!row) return null;

  const isReceita = row.type === "receita";

  const handleConfirm = () => {
    const desc = description.trim() || rawDescription;
    onConfirm({
      description: desc,
      category: { ...category, touched: true },
      contact: {
        supplier_id: !isReceita ? (supplierId || null) : null,
        client_id: isReceita ? (clientId || null) : null,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar novo lançamento</DialogTitle>
          <DialogDescription>
            Confirme a descrição, o {isReceita ? "cliente" : "fornecedor"} e a
            categoria antes de importar. Isso mantém seu extrato organizado e
            rastreável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/30 p-3 text-xs flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              {fmtDate(row.date)}
            </span>
            <span
              className={`font-mono font-semibold ${
                isReceita ? "text-emerald-600" : "text-foreground"
              }`}
            >
              {isReceita ? "+ " : "− "}
              {fmtMoney(Math.abs(row.amount))}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-desc">Descrição</Label>
            <Input
              id="review-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Formatura Ana"
              autoFocus
            />
            {rawDescription && rawDescription !== description && (
              <p className="text-[10px] text-muted-foreground">
                Original: <span className="font-mono">{rawDescription}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{isReceita ? "Cliente" : "Fornecedor"}</Label>
            {isReceita ? (
              <ContactSelectWithCreate
                contacts={clients}
                value={clientId}
                onChange={setClientId}
                type="client"
                placeholder="Selecione o cliente"
                onContactCreated={(id) => {
                  setClientId(id);
                  onContactCreated?.("client", id, description);
                }}
              />
            ) : (
              <ContactSelectWithCreate
                contacts={suppliers}
                value={supplierId}
                onChange={setSupplierId}
                type="supplier"
                placeholder="Selecione o fornecedor"
                onContactCreated={(id) => {
                  setSupplierId(id);
                  onContactCreated?.("supplier", id, description);
                }}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <CategoryPathCombobox
              categories={categories}
              value={category}
              type={row.type}
              onChange={(v) => setCategory(v)}
              onCreateCategory={onCreateCategory}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Check className="h-4 w-4" />
            Confirmar revisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
