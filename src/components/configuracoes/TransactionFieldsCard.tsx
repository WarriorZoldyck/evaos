import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";
import { useFormFieldSettings, type FormFieldSettings } from "@/hooks/useFormFieldSettings";

const FIELD_LABELS: { key: keyof FormFieldSettings; label: string; description: string }[] = [
  { key: "supplier_client", label: "Fornecedor / Cliente", description: "Select de fornecedor ou cliente" },
  { key: "contact_name", label: "Nome do contato", description: "Campo de texto livre para contato" },
  { key: "subcategories", label: "Subcategorias", description: "Subcategoria e sub-subcategoria" },
  { key: "payment_method", label: "Forma de pagamento", description: "PIX, boleto, cartão, etc." },
  { key: "account_fields", label: "Conta / Cartão / Carteira", description: "Campos de conta bancária, cartão e maquininha" },
  { key: "installments", label: "Parcelamento", description: "Opção de parcelar o lançamento" },
  { key: "recurring", label: "Recorrência", description: "Lançamento fixo / recorrente" },
  { key: "notes", label: "Observações", description: "Campo de texto para anotações" },
  { key: "barcode", label: "Código de barras", description: "Campo para código de barras" },
  { key: "attachment_url", label: "Anexo (URL)", description: "Link para arquivo anexo" },
];

export function TransactionFieldsCard() {
  const { settings, loading, updateField } = useFormFieldSettings();

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Campos do Formulário de Lançamentos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Escolha quais campos opcionais aparecem ao criar um lançamento. Campos obrigatórios (descrição, valor, data, categoria, status) permanecem sempre visíveis.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {FIELD_LABELS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
          >
            <div className="space-y-0.5">
              <Label htmlFor={`field-${key}`} className="text-sm font-medium cursor-pointer">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch
              id={`field-${key}`}
              checked={settings[key]}
              onCheckedChange={(checked) => updateField(key, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
