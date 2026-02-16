import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryGroup } from "@/hooks/useCashFlowData";

interface Props {
  revenueGroups: CategoryGroup[];
  expenseGroups: CategoryGroup[];
  totalRevenue: number;
  totalExpense: number;
  result: number;
  loading: boolean;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SectionRows({
  groups,
  label,
  total,
  colorClass,
}: {
  groups: CategoryGroup[];
  label: string;
  total: number;
  colorClass: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Section header */}
      <TableRow className="bg-muted/60 hover:bg-muted/60">
        <TableCell className="font-bold text-xs uppercase tracking-wider py-2">{label}</TableCell>
        <TableCell className={`text-right font-bold py-2 ${colorClass}`}>{formatBRL(total)}</TableCell>
      </TableRow>

      {groups.map((g) => {
        const isOpen = expanded.has(g.categoryId);
        const hasChildren = g.children.length > 0;

        return (
          <span key={g.categoryId}>
            {/* Parent category row */}
            <TableRow
              className={hasChildren ? "cursor-pointer" : ""}
              onClick={() => hasChildren && toggle(g.categoryId)}
            >
              <TableCell className="py-1.5 pl-6">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {hasChildren &&
                    (isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    ))}
                  {!hasChildren && <span className="w-3.5" />}
                  {g.categoryName}
                </span>
              </TableCell>
              <TableCell className={`text-right py-1.5 text-sm font-medium ${colorClass}`}>
                {formatBRL(g.total)}
              </TableCell>
            </TableRow>

            {/* Children rows */}
            {isOpen &&
              g.children.map((child) => (
                <TableRow key={child.categoryId} className="hover:bg-muted/30">
                  <TableCell className="py-1 pl-14 text-sm text-muted-foreground">
                    {child.name}
                  </TableCell>
                  <TableCell className={`text-right py-1 text-sm ${colorClass} opacity-80`}>
                    {formatBRL(child.total)}
                  </TableCell>
                </TableRow>
              ))}
          </span>
        );
      })}

      {groups.length === 0 && (
        <TableRow>
          <TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-3">
            Nenhum lançamento no período
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function CategoryReportTable({ revenueGroups, expenseGroups, totalRevenue, totalExpense, result, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableBody>
        <SectionRows
          groups={revenueGroups}
          label="Receitas"
          total={totalRevenue}
          colorClass="text-emerald-600 dark:text-emerald-400"
        />

        {/* Spacer */}
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={2} className="py-1" />
        </TableRow>

        <SectionRows
          groups={expenseGroups}
          label="Despesas"
          total={totalExpense}
          colorClass="text-red-600 dark:text-red-400"
        />

        {/* Result row */}
        <TableRow className="bg-muted hover:bg-muted border-t-2">
          <TableCell className="font-bold py-3">RESULTADO</TableCell>
          <TableCell
            className={`text-right font-bold py-3 text-base ${
              result >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatBRL(result)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
