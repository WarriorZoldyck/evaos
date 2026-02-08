import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Edit, Copy, Trash2, AlertTriangle } from "lucide-react";
import type { Procedure, CostSummary } from "@/hooks/usePricing";

interface ProcedureTableProps {
  procedures: Procedure[];
  costSummary: CostSummary;
  profitMargin: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (proc: Procedure) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  calcPrice: (proc: Procedure) => {
    custoFixoProporcional: number;
    custosVariaveis: number;
    subtotal: number;
    margemValor: number;
    precoSugerido: number;
  };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProcedureTable({
  procedures, selectedId, onSelect, onEdit, onDuplicate, onDelete, calcPrice,
}: ProcedureTableProps) {
  if (procedures.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhum procedimento cadastrado. Clique em "+ Novo Procedimento" para começar.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="text-center">Tempo (h)</TableHead>
            <TableHead className="text-right">Custos Var.</TableHead>
            <TableHead className="text-right">Custo Total</TableHead>
            <TableHead className="text-right">Preço Sugerido</TableHead>
            <TableHead className="text-right">Preço Desejado</TableHead>
            <TableHead className="text-right w-[120px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {procedures.map((proc) => {
            const calc = calcPrice(proc);
            const belowCost = proc.desired_price > 0 && proc.desired_price < calc.subtotal;
            const isSelected = selectedId === proc.id;

            return (
              <TableRow
                key={proc.id}
                className={`cursor-pointer ${isSelected ? "bg-accent" : ""}`}
                onClick={() => onSelect(proc.id)}
              >
                <TableCell className="font-medium">{proc.name}</TableCell>
                <TableCell className="text-center">{proc.execution_time}</TableCell>
                <TableCell className="text-right">{fmt(calc.custosVariaveis)}</TableCell>
                <TableCell className="text-right">{fmt(calc.subtotal)}</TableCell>
                <TableCell className="text-right font-semibold text-primary">
                  {fmt(calc.precoSugerido)}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1">
                    {proc.desired_price > 0 ? fmt(proc.desired_price) : "—"}
                    {belowCost && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>Preço abaixo do custo!</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => onEdit(proc)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDuplicate(proc.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(proc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
