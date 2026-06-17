import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  type: "supplier" | "client";
  editData?: { id: string; name: string; document?: string; company_id?: string | null } | null;
  companies?: Array<{ id: string; name: string }>;
  onSave: (data: { name: string; document?: string; company_id?: string | null }) => Promise<boolean>;
}

const PERSONAL_VALUE = "__personal__";

export function ContactFormModal({ open, onClose, type, editData, companies = [], onSave }: ContactFormModalProps) {
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [companyId, setCompanyId] = useState<string>(PERSONAL_VALUE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editData?.name || "");
      setDocument(editData?.document || "");
      setCompanyId(editData?.company_id || PERSONAL_VALUE);
    }
  }, [open, editData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const success = await onSave({
      name: name.trim(),
      document: document.trim() || undefined,
      company_id: companyId === PERSONAL_VALUE ? null : companyId,
    });
    setSaving(false);
    if (success) onClose();
  };

  const isSupplier = type === "supplier";
  const title = editData
    ? `Editar ${isSupplier ? "Fornecedor" : "Cliente"}`
    : `Novo ${isSupplier ? "Fornecedor" : "Cliente"}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Nome *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSupplier ? "Nome do fornecedor" : "Nome do cliente"}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-doc">{isSupplier ? "CNPJ" : "CPF/CNPJ"}</Label>
            <Input
              id="contact-doc"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder={isSupplier ? "00.000.000/0000-00" : "000.000.000-00"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-context">Contexto padrão</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger id="contact-context">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONAL_VALUE}>Pessoal</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Lançamentos da EVA (WhatsApp) com este {isSupplier ? "fornecedor" : "cliente"} usarão este contexto automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editData ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
