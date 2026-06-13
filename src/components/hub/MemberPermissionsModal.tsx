import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Building2, Wallet, CreditCard, Landmark, Smartphone, User } from "lucide-react";
import { useMemberPermissions, type ResourceType } from "@/hooks/useMemberPermissions";

const TYPE_META: Record<ResourceType, { label: string; icon: typeof Shield }> = {
  company: { label: "Empresas", icon: Building2 },
  bank_account: { label: "Contas Bancárias", icon: Landmark },
  credit_card: { label: "Cartões de Crédito", icon: CreditCard },
  card_terminal: { label: "Maquininhas", icon: Smartphone },
  wallet: { label: "Carteiras", icon: Wallet },
};

const ORDER: ResourceType[] = ["company", "bank_account", "credit_card", "card_terminal", "wallet"];

const PESSOAL = "__pessoal__";

export function MemberPermissionsModal({
  open, onClose, memberId, memberName,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string | null;
  memberName: string;
}) {
  const { resources, companies, isGranted, togglePermission, clearAll, hasAnyScope, loading } =
    useMemberPermissions(open ? memberId : null);
  const [context, setContext] = useState<string>(PESSOAL);

  const filtered = resources.filter((r) => {
    if (context === PESSOAL) {
      // Pessoal: recursos sem empresa. "company" não aparece em Pessoal.
      return r.type !== "company" && r.company_id === null;
    }
    return r.company_id === context;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Acesso de {memberName}
          </DialogTitle>
          <DialogDescription>
            {hasAnyScope
              ? "Membro vê APENAS os recursos marcados."
              : "Sem nada marcado, o membro vê TUDO da sua conta."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">Contexto</Label>
          <Select value={context} onValueChange={setContext}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PESSOAL}>
                <span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> Pessoal</span>
              </SelectItem>
              {companies.map((co) => (
                <SelectItem key={co.id} value={co.id}>
                  <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> {co.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Selecione o contexto para ver apenas os recursos correspondentes.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-5 pr-2">
            {ORDER.map((type) => {
              const items = filtered.filter((r) => r.type === type);
              if (items.length === 0) return null;
              const meta = TYPE_META[type];
              const Icon = meta.icon;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{items.length}</Badge>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    {items.map((r) => {
                      const granted = isGranted(type, r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 rounded px-2 py-1">
                          <Checkbox
                            checked={granted}
                            onCheckedChange={(v) => togglePermission(type, r.id, v === true)}
                          />
                          <span className="flex-1 truncate">{r.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum recurso cadastrado neste contexto.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" onClick={clearAll} disabled={!hasAnyScope}>
            Liberar tudo
          </Button>
          <Button onClick={onClose}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
