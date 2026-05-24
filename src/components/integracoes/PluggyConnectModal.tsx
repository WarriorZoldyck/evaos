import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";
import { usePluggyIntegration } from "@/hooks/usePluggyIntegration";
import { useAccounts } from "@/hooks/useAccounts";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

interface PluggyConnectModalProps {
  open: boolean;
  onClose: () => void;
}

// Pluggy widget script (CDN)
const PLUGGY_SCRIPT = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PluggyConnect: any;
  }
}

function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.PluggyConnect) return resolve();
    const existing = document.querySelector(`script[src="${PLUGGY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = PLUGGY_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar widget Pluggy"));
    document.head.appendChild(s);
  });
}

export function PluggyConnectModal({ open, onClose }: PluggyConnectModalProps) {
  const { requestConnectToken, finalizeConnect } = usePluggyIntegration();
  const { bankAccounts } = useAccounts();
  const { companies, selectedCompanyId, isPersonal } = useCompany();
  const { toast } = useToast();

  const [mode, setMode] = useState<"new_account" | "link_existing">("new_account");
  const [accountName, setAccountName] = useState("Conta bancária");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>(isPersonal ? "__personal__" : (selectedCompanyId || "__personal__"));
  const [opening, setOpening] = useState(false);

  const widgetRef = useRef<unknown>(null);

  const reset = () => {
    setMode("new_account"); setAccountName("Conta bancária"); setBankAccountId("");
  };

  useEffect(() => {
    if (!open) return;
    // preload script in background
    loadPluggyScript().catch(() => {/* will retry on submit */});
  }, [open]);

  const handleStart = async () => {
    setOpening(true);
    try {
      await loadPluggyScript();
      const accessToken = await requestConnectToken();
      if (!accessToken) throw new Error("Não foi possível gerar o token de conexão.");

      // Capture form selections in closure
      const selection = {
        mode,
        bank_account_id: mode === "link_existing" ? bankAccountId : undefined,
        account_name: mode === "new_account" ? accountName : undefined,
        company_id: companyId === "__personal__" ? null : companyId,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PluggyConnect = (window as any).PluggyConnect;
      const instance = new PluggyConnect({
        connectToken: accessToken,
        includeSandbox: true,
        onSuccess: async (itemData: { item: { id: string } }) => {
          try {
            await finalizeConnect.mutateAsync({
              item_id: itemData.item.id,
              ...selection,
            });
            reset();
            onClose();
          } catch (e) {
            toast({ title: "Erro ao salvar conexão", description: (e as Error).message, variant: "destructive" });
          }
        },
        onError: (err: { message?: string }) => {
          if (err?.message) toast({ title: "Erro Pluggy", description: err.message, variant: "destructive" });
        },
        onClose: () => { /* user closed widget */ },
      });
      widgetRef.current = instance;
      instance.init();
    } catch (e) {
      toast({ title: "Falha", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar conta via Pluggy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs flex gap-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              Conexão Open Finance via <strong>Pluggy</strong> — múltiplos bancos suportados
              (Itaú, Bradesco, Santander, Nubank, C6, etc.). Você fará login direto no banco;
              a EVA não vê sua senha.
            </span>
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
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "new_account" | "link_existing")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new_account" id="pgnew" />
                <Label htmlFor="pgnew" className="font-normal cursor-pointer">Criar nova conta com saldo do banco</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="link_existing" id="pglink" />
                <Label htmlFor="pglink" className="font-normal cursor-pointer">Vincular a uma conta existente</Label>
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
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={opening || finalizeConnect.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleStart}
            disabled={
              opening ||
              finalizeConnect.isPending ||
              (mode === "link_existing" && !bankAccountId) ||
              (mode === "new_account" && !accountName.trim())
            }
          >
            {(opening || finalizeConnect.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Abrir conexão Pluggy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
