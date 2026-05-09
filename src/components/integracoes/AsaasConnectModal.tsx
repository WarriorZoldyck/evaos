import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ExternalLink } from "lucide-react";
import { useAsaasIntegration } from "@/hooks/useAsaasIntegration";
import { useAccounts } from "@/hooks/useAccounts";
import { useCompany } from "@/contexts/CompanyContext";

interface AsaasConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export function AsaasConnectModal({ open, onClose }: AsaasConnectModalProps) {
  const { connect } = useAsaasIntegration();
  const { bankAccounts } = useAccounts();
  const { companies, selectedCompanyId, isPersonal } = useCompany();

  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<"new_account" | "link_existing">("new_account");
  const [accountName, setAccountName] = useState("Conta Asaas");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>(isPersonal ? "__personal__" : (selectedCompanyId || "__personal__"));

  const reset = () => {
    setApiKey(""); setMode("new_account"); setAccountName("Conta Asaas"); setBankAccountId("");
  };

  const handleSubmit = async () => {
    const result = await connect.mutateAsync({
      api_key: apiKey.trim(),
      mode,
      bank_account_id: mode === "link_existing" ? bankAccountId : undefined,
      account_name: mode === "new_account" ? accountName : undefined,
      company_id: companyId === "__personal__" ? null : companyId,
    });
    if (result) { reset(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar conta Asaas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>API Key do Asaas (Produção)</Label>
            <Input
              type="password"
              placeholder="$aact_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <a
              href="https://www.asaas.com/customerApiAccessToken/index"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Como obter sua API Key <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <Label>Contexto</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__personal__">Pessoal</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Como vincular?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new_account" id="new" />
                <Label htmlFor="new" className="font-normal cursor-pointer">Criar nova conta bancária com saldo do Asaas</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="link_existing" id="link" />
                <Label htmlFor="link" className="font-normal cursor-pointer">Vincular a uma conta existente</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === "new_account" ? (
            <div className="space-y-2">
              <Label>Nome da nova conta</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={80} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Conta existente</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={connect.isPending}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              connect.isPending ||
              !apiKey.trim() ||
              (mode === "link_existing" && !bankAccountId) ||
              (mode === "new_account" && !accountName.trim())
            }
          >
            {connect.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Conectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
