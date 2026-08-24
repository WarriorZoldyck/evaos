import { useState, useRef, useCallback, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreHorizontal, Edit, Copy, Trash2, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

/** Parse pt-BR number: replaces comma with dot */
function parsePtBR(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  return parseFloat(cleaned);
}

interface ProcedureTableV2Props {
  procedures: ProcedureV2[];
  calcProcedure: (proc: ProcedureV2) => { cf: number; cv: number; nf: number; liquido: number; lucro: number; lucratividadeHora: number; lucratividadePct: number };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (proc: ProcedureV2) => void;
  onDuplicate: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onInlineUpdate?: (id: string, data: { desired_price?: number; execution_time?: number; quantity?: number }) => void;
  calcParts?: (input: { execution_time: number; quantity: number; items: { value: number; unit_type: ProcedureV2["items"][number]["unit_type"] }[] }) => { qty: number; cf: number; cv: number };
  taxRate?: number;
}

function LiveNumberInput({ value, onCommit, prefix, suffix, step = 0.01, min = 0, className, invalid }: {
  value: number;
  onCommit: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  className?: string;
  invalid?: boolean;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const lastExternalValue = useRef(value);

  // Sync from parent when not focused and value actually changed externally
  useEffect(() => {
    if (!focused && value !== lastExternalValue.current) {
      setLocalValue(String(value));
      lastExternalValue.current = value;
    }
  }, [value, focused]);

  const commit = useCallback((raw: string) => {
    const num = parsePtBR(raw);
    if (!isNaN(num) && num >= min) {
      lastExternalValue.current = num;
      onCommit(num);
    }
  }, [onCommit, min]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    // Fire update on every valid change for live preview
    const num = parsePtBR(raw);
    if (!isNaN(num) && num >= min) {
      onCommit(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commit(localValue);
      (e.target as HTMLInputElement).blur();
    }
  };

  const displayValue = focused ? localValue : String(value);

  return (
    <div className={`flex items-center gap-1 ${className || ""}`} onClick={(e) => e.stopPropagation()}>
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <Input
        type="number"
        min={min}
        step={step}
        className={`w-24 h-7 text-right text-sm ${invalid ? "border-destructive text-destructive" : ""}`}
        value={displayValue}
        onFocus={() => {
          setFocused(true);
          setLocalValue(String(value));
        }}
        onChange={handleChange}
        onBlur={() => {
          setFocused(false);
          commit(localValue);
        }}
        onKeyDown={handleKeyDown}
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export function ProcedureTableV2({ procedures, calcProcedure, selectedId, onSelect, onEdit, onDuplicate, onDelete, onInlineUpdate, calcParts, taxRate = 0 }: ProcedureTableV2Props) {
  const [invalidMargin, setInvalidMargin] = useState<{ id: string; attempted: number; maxPct: number } | null>(null);

  const applyMargin = (proc: ProcedureV2, pct: number) => {
    if (!onInlineUpdate || !calcParts) return;
    const divisor = 1 - pct / 100 - taxRate / 100;
    if (divisor <= 0) return;
    const parts = calcParts(proc);
    onInlineUpdate(proc.id, { desired_price: Math.round(((parts.cf + parts.cv) / divisor) * 100) / 100 });
  };

  if (procedures.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum procedimento cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Procedimento</TableHead>
          <TableHead className="text-right">Qtd</TableHead>
          <TableHead className="text-right">Tempo (h)</TableHead>
          <TableHead className="text-right">Lucr. %</TableHead>
          <TableHead className="text-right">Preço</TableHead>
          <TableHead className="text-right">Preço/un.</TableHead>

          <TableHead className="text-right">CF</TableHead>
          <TableHead className="text-right">CV</TableHead>
          <TableHead className="text-right">NF</TableHead>
          <TableHead className="text-right">Líquido</TableHead>
          <TableHead className="text-right">Lucr./h</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {procedures.map((proc) => {
          const calc = calcProcedure(proc);
          const isSelected = selectedId === proc.id;
          const isNegative = calc.lucro < 0;
          const rowInvalid = invalidMargin?.id === proc.id ? invalidMargin : null;

          return (
            <TableRow
              key={proc.id}
              className={`cursor-pointer ${isSelected ? "bg-muted" : ""}`}
              onClick={() => onSelect(isSelected ? null : proc.id)}
            >
              <TableCell className="font-medium">{proc.name}</TableCell>
              <TableCell className="text-right">
                {onInlineUpdate ? (
                  <LiveNumberInput
                    value={proc.quantity ?? 1}
                    step={1}
                    min={1}
                    onCommit={(v) => {
                      const qty = Math.max(1, Math.round(v));
                      // Quantidade não altera a lucratividade: reajusta o preço para manter a margem.
                      if (calcParts) {
                        const pct = calc.lucratividadePct;
                        const divisor = 1 - pct / 100 - taxRate / 100;
                        if (divisor > 0) {
                          const parts = calcParts({ ...proc, quantity: qty } as any);
                          onInlineUpdate(proc.id, {
                            quantity: qty,
                            desired_price: Math.round(((parts.cf + parts.cv) / divisor) * 100) / 100,
                          });
                          return;
                        }
                      }
                      onInlineUpdate(proc.id, { quantity: qty });
                    }}

                  />
                ) : <span>{proc.quantity ?? 1}</span>}
              </TableCell>
              <TableCell className="text-right">
                {onInlineUpdate ? (
                  <LiveNumberInput
                    value={proc.execution_time}
                    step={0.5}
                    suffix="h"
                    onCommit={(v) => onInlineUpdate(proc.id, { execution_time: v })}
                  />
                ) : <span>{proc.execution_time}h</span>}
              </TableCell>
              <TableCell className="text-right">
                {onInlineUpdate && calcParts ? (
                  <div className="flex items-center justify-end gap-1">
                    <LiveNumberInput
                      value={Number(calc.lucratividadePct.toFixed(1))}
                      step={0.5}
                      min={-1000}
                      suffix="%"
                      invalid={!!rowInvalid}
                      onCommit={(pct) => {
                        const divisor = 1 - pct / 100 - taxRate / 100;
                        if (divisor <= 0) {
                          const maxPct = Math.max(0, Math.round((100 - taxRate - 0.1) * 10) / 10);
                          if (!(rowInvalid && rowInvalid.attempted === pct)) {
                            toast.error("Lucratividade impossível", {
                              description: taxRate > 0
                                ? `Com alíquota de ${fmtPct(taxRate)}, a lucratividade máxima é ${fmtPct(maxPct)}.`
                                : `A lucratividade precisa ser menor que 100%.`,
                            });
                          }
                          setInvalidMargin({ id: proc.id, attempted: pct, maxPct });
                          return;
                        }
                        setInvalidMargin((cur) => (cur?.id === proc.id ? null : cur));
                        applyMargin(proc, pct);
                      }}
                    />
                    {rowInvalid && (
                      <Popover>
                        <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 bg-popover z-50 text-left" onClick={(e) => e.stopPropagation()}>
                          <p className="text-sm font-medium text-destructive">Cenário impossível</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {taxRate > 0
                              ? `Você pediu ${fmtPct(rowInvalid.attempted)} de lucratividade, mas com alíquota de ${fmtPct(taxRate)} a margem máxima possível é ${fmtPct(rowInvalid.maxPct)}. Acima disso o preço tenderia ao infinito.`
                              : `Você pediu ${fmtPct(rowInvalid.attempted)} de lucratividade. A margem precisa ser menor que 100%, senão o preço tenderia ao infinito.`}
                          </p>
                          <Button
                            size="sm"
                            className="w-full mt-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              applyMargin(proc, rowInvalid.maxPct);
                              setInvalidMargin(null);
                            }}
                          >
                            Usar margem máxima ({fmtPct(rowInvalid.maxPct)})
                          </Button>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                ) : <span className={isNegative ? "text-destructive" : ""}>{fmtPct(calc.lucratividadePct)}</span>}
              </TableCell>
              <TableCell className="text-right">
                {onInlineUpdate ? (
                  <LiveNumberInput
                    value={proc.desired_price}
                    prefix="R$"
                    onCommit={(v) => onInlineUpdate(proc.id, { desired_price: v })}
                  />
                ) : <span>{fmt(proc.desired_price)}</span>}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {fmt(proc.desired_price / Math.max(1, proc.quantity ?? 1))}
              </TableCell>

              <TableCell className="text-right text-muted-foreground">{fmt(calc.cf)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{fmt(calc.cv)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{fmt(calc.nf)}</TableCell>
              <TableCell className={`text-right font-bold ${isNegative ? "text-destructive" : "text-emerald-600"}`}>
                {fmt(calc.liquido)}
              </TableCell>
              <TableCell className={`text-right ${isNegative ? "text-destructive" : ""}`}>{fmt(calc.lucratividadeHora)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Editar procedimento"
                  onClick={(e) => { e.stopPropagation(); onEdit(proc); }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(proc.id); }}>
                      <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(proc); }}>
                      <Edit className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(proc.id); }}>
                      <Copy className="h-4 w-4 mr-2" /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(proc.id); }}>
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
