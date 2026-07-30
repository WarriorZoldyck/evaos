import { useEffect, useMemo, useState } from "react";
import { Check, Layers, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CandidateTx } from "@/lib/import/matching";
import { validateGroupBalance, type GroupState } from "@/lib/import/grouping";

export interface GroupDialogRow {
  index: number;
  date: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
}

interface GroupMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leader: GroupDialogRow | null;
  /** Outras linhas do extrato ainda disponíveis para entrar no grupo (Caso B). */
  otherRows: GroupDialogRow[];
  /** Lançamentos do sistema disponíveis (já sem os presos em outros grupos). */
  candidates: CandidateTx[];
  initial?: GroupState;
  onConfirm: (state: GroupState) => void;
}

const fmt = (n: number) =>
  Math.abs(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2) ?? ""}`;
};

const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function GroupMatchDialog({
  open,
  onOpenChange,
  leader,
  otherRows,
  candidates,
  initial,
  onConfirm,
}: GroupMatchDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [extraRows, setExtraRows] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedIds(initial?.systemIds ?? []);
    setExtraRows(initial?.extraRowIdx ?? []);
    setSearch("");
  }, [open, initial]);

  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [String(c.id), c])),
    [candidates],
  );
  const rowByIndex = useMemo(
    () => new Map(otherRows.map((r) => [r.index, r])),
    [otherRows],
  );

  const statementRows = useMemo(() => {
    if (!leader) return [];
    return [
      { index: leader.index, amount: leader.amount },
      ...extraRows
        .map((i) => rowByIndex.get(i))
        .filter(Boolean)
        .map((r) => ({ index: r!.index, amount: r!.amount })),
    ];
  }, [leader, extraRows, rowByIndex]);

  const systemTxs = useMemo(
    () =>
      selectedIds
        .map((id) => candidateById.get(String(id)))
        .filter(Boolean)
        .map((c) => ({ id: String(c!.id), amount: Number(c!.amount) })),
    [selectedIds, candidateById],
  );

  const balance = useMemo(
    () => validateGroupBalance(statementRows, systemTxs),
    [statementRows, systemTxs],
  );

  const filteredCandidates = useMemo(() => {
    const q = normalize(search);
    const list = q
      ? candidates.filter(
          (c) =>
            normalize(c.description).includes(q) ||
            String(Math.abs(Number(c.amount)).toFixed(2)).includes(q.replace(",", ".")),
        )
      : candidates;
    // Selecionados sempre visíveis no topo.
    const sel = new Set(selectedIds.map(String));
    const picked = list.filter((c) => sel.has(String(c.id)));
    const rest = list.filter((c) => !sel.has(String(c.id))).slice(0, 200);
    return [...picked, ...rest];
  }, [candidates, search, selectedIds]);

  const toggleId = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleRow = (idx: number) =>
    setExtraRows((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx],
    );

  const handleConfirm = () => {
    if (!balance.valid) return;
    onConfirm({ systemIds: selectedIds.map(String), extraRowIdx: [...extraRows] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Agrupar conciliação
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione os lançamentos do sistema que, somados, correspondem a esta linha
            do extrato. Se o pagamento foi dividido em mais de uma linha, marque também
            as outras linhas do extrato.
          </DialogDescription>
        </DialogHeader>

        {leader && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Linha do extrato
            </p>
            <div className="flex items-start justify-between gap-3 mt-1">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{leader.description}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDate(leader.date)}</p>
              </div>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  leader.type === "receita" ? "text-emerald-600" : "text-foreground",
                )}
              >
                {fmt(leader.amount)}
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {otherRows.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5">
                Outras linhas do extrato{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </p>
              <ScrollArea className="max-h-40 rounded-md border">
                <div className="divide-y">
                  {otherRows.slice(0, 200).map((r) => (
                    <label
                      key={r.index}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={extraRows.includes(r.index)}
                        onCheckedChange={() => toggleRow(r.index)}
                      />
                      <span className="text-muted-foreground w-12 shrink-0">
                        {fmtDate(r.date)}
                      </span>
                      <span className="flex-1 truncate">{r.description}</span>
                      <span className="tabular-nums font-medium">{fmt(r.amount)}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium">Lançamentos do sistema</p>
              <Badge variant="secondary" className="text-[10px]">
                {selectedIds.length} selecionado{selectedIds.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="relative mb-1.5">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por descrição ou valor..."
                className="h-8 pl-7 text-xs"
              />
            </div>
            <ScrollArea className="h-64 rounded-md border">
              {filteredCandidates.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">
                  Nenhum lançamento disponível nesta janela de datas.
                </p>
              ) : (
                <div className="divide-y">
                  {filteredCandidates.map((c) => {
                    const id = String(c.id);
                    const checked = selectedIds.includes(id);
                    return (
                      <label
                        key={id}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-accent/40",
                          checked && "bg-primary/5",
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleId(id)} />
                        <span className="text-muted-foreground w-12 shrink-0">
                          {fmtDate(c.payment_date)}
                        </span>
                        <span className="flex-1 truncate">{c.description}</span>
                        {c.status === "Pago" && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            pago
                          </Badge>
                        )}
                        <span className="tabular-nums font-medium">{fmt(c.amount)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs flex items-center justify-between gap-3",
            balance.valid
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-muted/40",
          )}
        >
          <span>
            Selecionado <strong className="tabular-nums">{fmt(balance.systemTotal)}</strong> /
            extrato <strong className="tabular-nums">{fmt(balance.statementTotal)}</strong>
          </span>
          <span className="font-medium tabular-nums">
            {balance.valid
              ? "valores conferem"
              : balance.reason === "no-system"
                ? "selecione ao menos 1 lançamento"
                : `falta ${fmt(balance.delta)}`}
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!balance.valid}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Confirmar agrupamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
