import { useState, useRef, Fragment } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
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
  subtractOnExpand?: boolean;
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
  subtractOnExpand,
}: {
  rows: DRECategoryRow[];
  periods: string[];
  level: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  colorClass: string;
  rowCounter: { current: number };
  subtractOnExpand?: boolean;
}) {
  return (
    <>
      {rows.map((row) => {
        const hasChildren = row.children.length > 0;
        const isOpen = expanded.has(row.categoryId);
        const showResidual = subtractOnExpand && hasChildren && isOpen;

        const displayPer: Record<string, number> = {};
        periods.forEach((p) => {
          const own = row.monthlyTotals[p] || 0;
          if (showResidual) {
            const childSum = row.children.reduce((s, c) => s + (c.monthlyTotals[p] || 0), 0);
            displayPer[p] = own - childSum;
          } else {
            displayPer[p] = own;
          }
        });
        const total = Object.values(displayPer).reduce((s, v) => s + v, 0);
        const idx = rowCounter.current++;
        const isEven = idx % 2 === 0;

        return (
          <Fragment key={row.categoryId}>
            <tr
              className={cn(
                hasChildren ? "cursor-pointer font-medium" : "cursor-default",
                isEven ? "bg-muted/30" : "",
                "hover:bg-muted/50 border-b border-border/30"
              )}
              onClick={() => hasChildren && toggle(row.categoryId)}
            >
              <td
                className="whitespace-nowrap text-xs py-2"
                style={{ paddingLeft: 12 + level * INDENT_PX }}
              >
                <span className="flex items-center gap-1">
                  {hasChildren ? (
                    isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  {row.categoryName.toUpperCase()}
                  {showResidual && (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      · apenas nesta categoria
                    </span>
                  )}
                </span>
              </td>
              {periods.map((p) => (
                <td key={p} className={cn("text-right text-xs py-2 tabular-nums", colorClass)}>
                  {fmt(displayPer[p] || 0)}
                </td>
              ))}
              <td className={cn("text-right text-xs py-2 pr-3 font-semibold tabular-nums", colorClass)}>
                {fmt(total)}
              </td>
            </tr>
            {hasChildren && isOpen && (
              <CategoryRows
                rows={row.children}
                periods={periods}
                level={level + 1}
                expanded={expanded}
                toggle={toggle}
                colorClass={colorClass}
                rowCounter={rowCounter}
                subtractOnExpand={subtractOnExpand}
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
  subtractOnExpand,
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
  subtractOnExpand?: boolean;
}) {
  const grand = Object.values(totals).reduce((s, v) => s + v, 0);
  const rowCounter = useRef(0);
  rowCounter.current = 0;

  return (
    <>
      <tr
        className={cn("font-bold cursor-pointer border-b", sectionClassName)}
        onClick={() => toggleSection(sectionId)}
      >
        <td className="text-xs py-2 pl-3 whitespace-nowrap">
          <span className="flex items-center gap-1">
            {isSectionOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            {label}
          </span>
        </td>
        {periods.map((p) => (
          <td key={p} className="text-right text-xs py-2 tabular-nums">
            {fmt(totals[p] || 0)}
          </td>
        ))}
        <td className="text-right text-xs py-2 pr-3 tabular-nums font-bold">{fmt(grand)}</td>
      </tr>
      {isSectionOpen && (
        <CategoryRows
          rows={rows}
          periods={periods}
          level={1}
          expanded={expanded}
          toggle={toggle}
          colorClass={colorClass}
          rowCounter={rowCounter}
          subtractOnExpand={subtractOnExpand}
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
    <tr className={cn("font-bold border-b", className)}>
      <td className="text-xs py-2 pl-3 whitespace-nowrap">{label}</td>
      {periods.map((p) => (
        <td key={p} className="text-right text-xs py-2 tabular-nums">
          {fmt(totals[p] || 0)}
        </td>
      ))}
      <td className="text-right text-xs py-2 pr-3 tabular-nums font-bold">{fmt(grand)}</td>
    </tr>
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
  subtractOnExpand,
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

  const colCount = periods.length + 2; // category + periods + total

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse table-fixed" style={{ minWidth: `${200 + (colCount - 1) * 110}px` }}>
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left text-xs font-medium text-muted-foreground p-2 pl-3" style={{ width: 200 }}>Categoria</th>
            {periods.map((p) => (
              <th key={p} className="text-right text-xs font-medium text-muted-foreground p-2" style={{ width: 110 }}>
                {getPeriodLabel(p)}
              </th>
            ))}
            <th className="text-right text-xs font-bold text-muted-foreground p-2 pr-3" style={{ width: 120 }}>Total</th>
          </tr>
        </thead>
        <tbody>
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
            subtractOnExpand={subtractOnExpand}
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
            subtractOnExpand={subtractOnExpand}
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
        </tbody>
      </table>
    </div>
  );
}
