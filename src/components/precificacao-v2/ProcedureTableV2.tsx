import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Copy, Trash2, Eye } from "lucide-react";
import type { ProcedureV2 } from "@/hooks/usePricingV2";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface ProcedureTableV2Props {
  procedures: ProcedureV2[];
  calcProcedure: (proc: ProcedureV2) => { cf: number; cv: number; nf: number; lucro: number; lucratividadeHora: number; lucratividadePct: number };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (proc: ProcedureV2) => void;
  onDuplicate: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function ProcedureTableV2({ procedures, calcProcedure, selectedId, onSelect, onEdit, onDuplicate, onDelete }: ProcedureTableV2Props) {
  if (procedures.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum procedimento cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Procedimento</TableHead>
          <TableHead className="text-right">Tempo (h)</TableHead>
          <TableHead className="text-right">Preço</TableHead>
          <TableHead className="text-right">CF</TableHead>
          <TableHead className="text-right">CV</TableHead>
          <TableHead className="text-right">NF</TableHead>
          <TableHead className="text-right">Lucro</TableHead>
          <TableHead className="text-right">Lucr./h</TableHead>
          <TableHead className="text-right">Lucr. %</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {procedures.map((proc) => {
          const calc = calcProcedure(proc);
          const isSelected = selectedId === proc.id;
          const isNegative = calc.lucro < 0;

          return (
            <TableRow
              key={proc.id}
              className={`cursor-pointer ${isSelected ? "bg-muted" : ""}`}
              onClick={() => onSelect(isSelected ? null : proc.id)}
            >
              <TableCell className="font-medium">{proc.name}</TableCell>
              <TableCell className="text-right">{proc.execution_time}</TableCell>
              <TableCell className="text-right">{fmt(proc.desired_price)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{fmt(calc.cf)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{fmt(calc.cv)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{fmt(calc.nf)}</TableCell>
              <TableCell className={`text-right font-bold ${isNegative ? "text-destructive" : "text-emerald-600"}`}>
                {fmt(calc.lucro)}
              </TableCell>
              <TableCell className={`text-right ${isNegative ? "text-destructive" : ""}`}>{fmt(calc.lucratividadeHora)}</TableCell>
              <TableCell className={`text-right ${isNegative ? "text-destructive" : ""}`}>{fmtPct(calc.lucratividadePct)}</TableCell>
              <TableCell>
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
