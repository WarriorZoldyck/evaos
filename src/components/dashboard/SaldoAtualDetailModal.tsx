import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, Wallet as WalletIcon, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountCurrentBalances } from "@/hooks/useAccountCurrentBalances";
import type { BankAccount, Wallet } from "@/hooks/useAccounts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccounts: BankAccount[];
  wallets: Wallet[];
  contextLabel?: string;
  saldoAtual: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

export function SaldoAtualDetailModal({
  open,
  onOpenChange,
  bankAccounts,
  wallets,
  contextLabel,
  saldoAtual,
}: Props) {
  const navigate = useNavigate();
  const { balances: bankBalances, loading: loadingBanks } =
    useAccountCurrentBalances(bankAccounts, "bank");
  const { balances: walletBalances, loading: loadingWallets } =
    useAccountCurrentBalances(wallets, "wallet");

  const loading = loadingBanks || loadingWallets;

  const total = useMemo(() => {
    let t = 0;
    bankAccounts.forEach((a) => {
      t += bankBalances.get(a.id) ?? Number(a.initial_balance ?? 0);
    });
    wallets.forEach((w) => {
      t += walletBalances.get(w.id) ?? Number(w.initial_balance ?? 0);
    });
    return t;
  }, [bankAccounts, wallets, bankBalances, walletBalances]);

  const goToLancamentos = (accountId: string) => {
    const sp = new URLSearchParams();
    sp.set("accountId", accountId);
    onOpenChange(false);
    // Defer navigation so Radix can finish unmounting the portal cleanly
    setTimeout(() => navigate(`/lancamentos?${sp.toString()}`), 0);
  };

  const hasAny = bankAccounts.length > 0 || wallets.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center text-white shadow-md">
              <Landmark className="h-4 w-4" />
            </div>
            Saldo Atual por conta
          </DialogTitle>
          <DialogDescription>
            {contextLabel ? `Contexto: ${contextLabel}. ` : ""}
            Soma de saldo inicial + lançamentos pagos. Clique em uma conta para ver seus lançamentos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
          {/* Contas Bancárias */}
          {bankAccounts.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5" />
                Contas Bancárias
              </h4>
              <div className="rounded-lg border border-border overflow-hidden">
                {bankAccounts.map((a) => {
                  const bal = bankBalances.get(a.id);
                  const initial = Number(a.initial_balance ?? 0);
                  const value = bal ?? initial;
                  return (
                    <button
                      key={a.id}
                      onClick={() => goToLancamentos(`bank:${a.id}`)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Saldo inicial: {fmt(initial)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {loadingBanks ? (
                          <Skeleton className="h-5 w-24" />
                        ) : (
                          <span
                            className={`font-bold font-mono text-sm ${value >= 0 ? "text-foreground" : "text-destructive"}`}
                          >
                            {fmt(value)}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Carteiras */}
          {wallets.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                <WalletIcon className="h-3.5 w-3.5" />
                Carteiras
              </h4>
              <div className="rounded-lg border border-border overflow-hidden">
                {wallets.map((w) => {
                  const bal = walletBalances.get(w.id);
                  const initial = Number(w.initial_balance ?? 0);
                  const value = bal ?? initial;
                  return (
                    <button
                      key={w.id}
                      onClick={() => goToLancamentos(`wallet:${w.id}`)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{w.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Saldo inicial: {fmt(initial)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {loadingWallets ? (
                          <Skeleton className="h-5 w-24" />
                        ) : (
                          <span
                            className={`font-bold font-mono text-sm ${value >= 0 ? "text-foreground" : "text-destructive"}`}
                          >
                            {fmt(value)}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {!hasAny && (
            <div className="text-sm text-muted-foreground text-center py-8">
              Nenhuma conta ou carteira cadastrada neste contexto.
            </div>
          )}
        </div>

        {/* Total */}
        <div className="border-t border-border pt-3 mt-2 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total
            </p>
            <p className="text-[11px] text-muted-foreground">
              Saldo Atual do dashboard: {fmt(saldoAtual)}
            </p>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-32" />
          ) : (
            <p
              className={`text-xl font-bold font-display ${total >= 0 ? "text-foreground" : "text-destructive"}`}
            >
              {fmt(total)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
