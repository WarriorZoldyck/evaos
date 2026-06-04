import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { useItauIntegration } from "@/hooks/useItauIntegration";
import { useAccounts } from "@/hooks/useAccounts";
import { useCompany } from "@/contexts/CompanyContext";

interface Props { open: boolean; onClose: () => void; }

export function ItauConnectModal({ open, onClose }: Props) {
  const { connect } = useItauIntegration();
  const { bankAccounts } = useAccounts();
  const { companies, selectedCompanyId, isPersonal } = useCompany();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [certificate, setCertificate] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [agency, setAgency] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountDigit, setAccountDigit] = useState("");
  const [mode, setMode] = useState<"new_account" | "link_existing">("new_account");
  const [accountName, setAccountName] = useState("Conta Itaú");
  const [bankAccountId, setBankAccountId] = useState("");
  const [companyId, setCompanyId] = useState<string>(isPersonal ? "__personal__" : (selectedCompanyId || "__personal__"));

  const reset = () => {
    setClientId(""); setClientSecret(""); setCertificate(""); setEnvironment("sandbox");
    setAgency(""); setAccountNumber(""); setAccountDigit("");
    setMode("new_account"); setAccountName("Conta Itaú"); setBankAccountId("");
  };

  const onCertFile = async (file: File | null) => {
    if (!file) return;
    setCertificate(await file.text());
  };

  const handleSubmit = async () => {
    const result = await connect.mutateAsync({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      certificate: certificate.trim() || undefined,
      environment,
      agency: agency.trim() || undefined,
      account_number: accountNumber.trim() || undefined,
      account_digit: accountDigit.trim() || undefined,
      mode,
      bank_account_id: mode === "link_existing" ? bankAccountId : undefined,
      account_name: mode === "new_account" ? accountName : undefined,
      company_id: companyId === "__personal__" ? null : companyId,
    });
    if (result) { reset(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conectar conta Itaú (API B2B — apenas PJ)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div><b>Esta integração é exclusiva para contas PJ</b> que contrataram o pacote de API no Itaú (Cash Management / Open Finance B2B).</div>
              <div>Pré-requisitos: conta PJ Itaú ativa, pacote API contratado no gerente, e certificado mTLS (<code>.crt</code> + <code>.key</code>) gerado no <a href="https://developer.itau.com.br/" target="_blank" rel="noopener noreferrer" className="underline">Developer Portal do Itaú</a> com <code>client_id</code> e <code>client_secret</code>.</div>
              <div><b>Pessoa Física?</b> O Itaú não libera API direta para PF. Use <b>Lançamentos → Importar extrato</b> (OFX/PDF baixado do app Itaú) — é grátis e funciona hoje.</div>
              <div className="text-amber-600 dark:text-amber-400"><b>Status do handshake mTLS:</b> em desenvolvimento. Credenciais ficam salvas e a sincronização será ativada assim que o proxy mTLS estiver no ar.</div>
            </div>
          </div>


          <div className="space-y-2">
            <Label>Ambiente</Label>
            <RadioGroup value={environment} onValueChange={(v) => setEnvironment(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="sandbox" id="sb" /><Label htmlFor="sb" className="font-normal cursor-pointer">Sandbox</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="production" id="pr" /><Label htmlFor="pr" className="font-normal cursor-pointer">Produção</Label></div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Client ID</Label>
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ex.: 11111111-aaaa-bbbb-cccc-..." autoComplete="off" />
          </div>

          <div className="space-y-2">
            <Label>Client Secret</Label>
            <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" />
            <a href="https://developer.itau.com.br/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              Itaú Developer Portal <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <Label>Certificado mTLS (.pem) — opcional p/ sandbox</Label>
            <Input type="file" accept=".pem,.crt,.cer,.txt" onChange={(e) => onCertFile(e.target.files?.[0] ?? null)} />
            {certificate && (
              <Textarea value={certificate} onChange={(e) => setCertificate(e.target.value)} rows={3} className="font-mono text-[10px]" />
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2"><Label>Agência</Label><Input value={agency} onChange={(e) => setAgency(e.target.value)} maxLength={5} /></div>
            <div className="space-y-2"><Label>Conta</Label><Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={10} /></div>
            <div className="space-y-2"><Label>Dígito</Label><Input value={accountDigit} onChange={(e) => setAccountDigit(e.target.value)} maxLength={2} /></div>
          </div>

          <div className="space-y-2">
            <Label>Contexto</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__personal__">Pessoal</SelectItem>
                {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Como vincular?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="new_account" id="itau-new" /><Label htmlFor="itau-new" className="font-normal cursor-pointer">Criar nova conta bancária</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="link_existing" id="itau-link" /><Label htmlFor="itau-link" className="font-normal cursor-pointer">Vincular a uma conta existente</Label></div>
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
                  {bankAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
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
              !clientId.trim() || !clientSecret.trim() ||
              (environment === "production" && !certificate.trim()) ||
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
