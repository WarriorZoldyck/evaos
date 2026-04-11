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

const DRE_SECTIONS = [
  { value: "__none__", label: "Nenhum", sign: null },
  { value: "receita_operacional", label: "Receita Operacional", sign: "+" },
  { value: "impostos_venda", label: "Impostos sobre Venda", sign: "-" },
  { value: "cmv_csp", label: "CMV / CSP (Custos)", sign: "-" },
  { value: "despesas_vendas", label: "Despesas com Vendas", sign: "-" },
  { value: "despesas_operacionais", label: "Despesas Operacionais e Adm.", sign: "-" },
  { value: "despesas_financeiras", label: "Despesas Financeiras", sign: "-" },
  { value: "receita_financeira", label: "Receita Financeira", sign: "+" },
  { value: "despesas_gerais", label: "Despesas Gerais e Adm.", sign: "-" },
];

interface CategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  parentName?: string;
  editData?: { id: string; name: string; type: string | null; dre_section?: string | null } | null;
  defaultType?: string;
  onSave: (data: { name: string; type?: string; dre_section?: string | null }) => Promise<boolean>;
}

export function CategoryFormModal({ open, onClose, parentName, editData, defaultType, onSave }: CategoryFormModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("ambos");
  const [dreSection, setDreSection] = useState("__none__");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editData?.name || "");
      setType(editData?.type || defaultType || "ambos");
      setDreSection(editData?.dre_section || "__none__");
    }
  }, [open, editData, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const success = await onSave({
      name: name.trim(),
      type,
      dre_section: dreSection === "__none__" ? null : dreSection,
    });
    setSaving(false);
    if (success) onClose();
  };

  const title = editData
    ? "Editar Categoria"
    : parentName
    ? `Nova Subcategoria em "${parentName}"`
    : "Nova Categoria";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da categoria"
              required
            />
          </div>
          {!parentName && (
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambos">Ambos</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select value={dreSection} onValueChange={setDreSection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DRE_SECTIONS
                  .filter((s) => {
                    if (s.sign === null) return true;
                    if (type === "receita") return s.sign === "+";
                    if (type === "despesa") return s.sign === "-";
                    return true;
                  })
                  .map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vincule esta categoria a um centro de custo para o DRE. Deixe "Nenhum" para usar a classificação automática.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
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
