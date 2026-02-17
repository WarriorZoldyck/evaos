import { useState, useRef, Fragment } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DRECategoryRow } from "@/hooks/useDREData";
import { getPeriodLabel } from "@/hooks/useDREData";

interface DRETableProps {
  periods: string[];
  revenueRows: DRECategoryRow[];
  expenseRows: DRECategoryRow[];
  monthlyRevenueTotals: Record<string, number>;
  monthlyExpenseTotals: Record<string, number>;
  monthlyResults: Record<string, number>;
  loading: boolean;
}

const INDENT_PX = 20;

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function CategoryRows({
  rows,
  periods,
  level,
  expanded,
  toggle,
  colorClass,
  rowCounter,
}: {
  rows: DRECategoryRow[];
  periods: string[];
  level: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  colorClass: string;
  rowCounter: { current: number };
}) {
  return (
    <>
      {rows.map((row) => {
        const hasChildren = row.children.length > 0;
        const isOpen = expanded.has(row.categoryId);
        const total = Object.values(row.monthlyTotals).reduce((s, v) => s + v, 0);
        const idx = rowCounter.current++;
        const isEven = idx % 2 === 0;

        return (
          <Fragment key={row.categoryId}>
            <TableRow
              className={cn(
                hasChildren ? "cursor-pointer font-medium" : "cursor-default",
                isEven ? "bg-muted/30" : "",
                "hover:bg-muted/50"
              )}
              onClick={() => hasChildren && toggle(row.categoryId)}
            >
              <TableCell
                className="whitespace-nowrap text-xs py-2"
                style={{ paddingLeft: 12 + level * INDENT_PX }}
              >
                <span className="flex items-center gap-1">
                  {hasChildren ? (
                    isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  {row.categoryName}
                </span>
              </TableCell>
              {periods.map((p) => (
                <TableCell key={p} className={cn("text-right text-xs py-2 tabular-nums", colorClass)}>
                  {fmt(row.monthlyTotals[p] || 0)}
                </TableCell>
              ))}
              <TableCell className={cn("text-right text-xs py-2 font-semibold tabular-nums", colorClass)}>
                {fmt(total)}
              </TableCell>
            </TableRow>
            {hasChildren && isOpen && (
              <CategoryRows
                rows={row.children}
                periods={periods}
                level={level + 1}
                expanded={expanded}
                toggle={toggle}
                colorClass={colorClass}
                rowCounter={rowCounter}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function SectionBlock({
  sectionId,
  label,
  totals,
  rows,
  periods,
  expanded,
  toggle,
  toggleSection,
  isSectionOpen,
  sectionClassName,
  colorClass,
}: {
  sectionId: string;
  label: string;
  totals: Record<string, number>;
  rows: DRECategoryRow[];
  periods: string[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  toggleSection: (id: string) => void;
  isSectionOpen: boolean;
  sectionClassName: string;
  colorClass: string;
}) {
  const grand = Object.values(totals).reduce((s, v) => s + v, 0);
  const rowCounter = useRef(0);
  rowCounter.current = 0;

  return (
    <>
      <TableRow
        className={cn("font-bold cursor-pointer", sectionClassName)}
        onClick={() => toggleSection(sectionId)}
      >
        <TableCell className="text-xs py-2 pl-3 whitespace-nowrap">
          <span className="flex items-center gap-1">
            {isSectionOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            {label}
          </span>
        </TableCell>
        {periods.map((p) => (
          <TableCell key={p} className="text-right text-xs py-2 tabular-nums">
            {fmt(totals[p] || 0)}
          </TableCell>
        ))}
        <TableCell className="text-right text-xs py-2 tabular-nums font-bold">{fmt(grand)}</TableCell>
      </TableRow>
      {isSectionOpen && (
        <CategoryRows
          rows={rows}
          periods={periods}
          level={1}
          expanded={expanded}
          toggle={toggle}
          colorClass={colorClass}
          rowCounter={rowCounter}
        />
      )}
    </>
  );
}

function TotalRow({
  label,
  totals,
  periods,
  className,
}: {
  label: string;
  totals: Record<string, number>;
  periods: string[];
  className?: string;
}) {
  const grand = Object.values(totals).reduce((s, v) => s + v, 0);
  return (
    <TableRow className={cn("font-bold", className)}>
      <TableCell className="text-xs py-2 pl-3 whitespace-nowrap">{label}</TableCell>
      {periods.map((p) => (
        <TableCell key={p} className="text-right text-xs py-2 tabular-nums">
          {fmt(totals[p] || 0)}
        </TableCell>
      ))}
      <TableCell className="text-right text-xs py-2 tabular-nums font-bold">{fmt(grand)}</TableCell>
    </TableRow>
  );
}

export function DRETable({
  periods,
  revenueRows,
  expenseRows,
  monthlyRevenueTotals,
  monthlyExpenseTotals,
  monthlyResults,
  loading,
}: DRETableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const negExpTotals = Object.fromEntries(periods.map((p) => [p, -(monthlyExpenseTotals[p] || 0)]));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[200px] text-xs">Categoria</TableHead>
            {periods.map((p) => (
              <TableHead key={p} className="text-right text-xs min-w-[100px]">
                {getPeriodLabel(p)}
              </TableHead>
            ))}
            <TableHead className="text-right text-xs min-w-[110px] font-bold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Revenue section - collapsible */}
          <SectionBlock
            sectionId="__revenue__"
            label="(+) RECEITAS"
            totals={monthlyRevenueTotals}
            rows={revenueRows}
            periods={periods}
            expanded={expanded}
            toggle={toggle}
            toggleSection={toggleSection}
            isSectionOpen={sections.has("__revenue__")}
            sectionClassName="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-b"
            colorClass="text-emerald-700 dark:text-emerald-400"
          />

          {/* Expense section - collapsible */}
          <SectionBlock
            sectionId="__expense__"
            label="(-) DESPESAS"
            totals={negExpTotals}
            rows={expenseRows}
            periods={periods}
            expanded={expanded}
            toggle={toggle}
            toggleSection={toggleSection}
            isSectionOpen={sections.has("__expense__")}
            sectionClassName="bg-destructive/10 text-destructive border-b"
            colorClass="text-destructive"
          />

          {/* Result */}
          <TotalRow
            label="= RESULTADO"
            totals={monthlyResults}
            periods={periods}
            className={cn(
              "border-t-2",
              Object.values(monthlyResults).reduce((s, v) => s + v, 0) >= 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive"
            )}
          />
        </TableBody>
      </Table>
    </div>
  );
}
