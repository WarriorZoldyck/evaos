import { useState, useRef, Fragment } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DRESection, DRECategoryRow } from "@/hooks/useDREData";
import { getPeriodLabel } from "@/hooks/useDREData";

interface DRETableContabilProps {
  periods: string[];
  sections: DRESection[];
  loading: boolean;
  showVerticalAnalysis: boolean;
}

const INDENT_PX = 20;

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function CategoryRows({
  rows,
  periods,
  level,
  expanded,
  toggle,
  colorClass,
  rowCounter,
  receitaTotal,
  showPct,
}: {
  rows: DRECategoryRow[];
  periods: string[];
  level: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  colorClass: string;
  rowCounter: { current: number };
  receitaTotal: number;
  showPct: boolean;
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
            <tr
              className={cn(
                hasChildren ? "cursor-pointer font-medium" : "cursor-default",
                isEven ? "bg-muted/30" : "",
                "hover:bg-muted/50 border-b border-border/30"
              )}
              onClick={() => hasChildren && toggle(row.categoryId)}
            >
              <td className="whitespace-nowrap text-xs py-2" style={{ paddingLeft: 12 + level * INDENT_PX }}>
                <span className="flex items-center gap-1">
                  {hasChildren ? (
                    isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  {row.categoryName.toUpperCase()}
                </span>
              </td>
              {periods.map((p) => (
                <td key={p} className={cn("text-right text-xs py-2 tabular-nums", colorClass)}>
                  {fmt(row.monthlyTotals[p] || 0)}
                </td>
              ))}
              <td className={cn("text-right text-xs py-2 pr-2 font-semibold tabular-nums", colorClass)}>
                {fmt(total)}
              </td>
              {showPct && (
                <td className="text-right text-xs py-2 pr-3 tabular-nums text-muted-foreground">
                  {receitaTotal > 0 ? fmtPct((total / receitaTotal) * 100) : "-"}
                </td>
              )}
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
                receitaTotal={receitaTotal}
                showPct={showPct}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function getSectionStyle(section: DRESection) {
  if (section.isCalculated) {
    // Result rows
    const total = Object.values(section.monthlyTotals).reduce((s, v) => s + v, 0);
    if (section.key === "lucro_liquido") {
      return {
        row: cn("font-bold border-t-2 border-b", total >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"),
        color: total >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
      };
    }
    return {
      row: "font-bold bg-muted/60 border-b",
      color: "text-foreground",
    };
  }
  if (section.sign === "+") {
    return {
      row: "font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-b cursor-pointer",
      color: "text-emerald-700 dark:text-emerald-400",
    };
  }
  return {
    row: "font-bold bg-destructive/10 text-destructive border-b cursor-pointer",
    color: "text-destructive",
  };
}

export function DRETableContabil({ periods, sections, loading, showVerticalAnalysis }: DRETableContabilProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const receitaOperacional = sections.find((s) => s.key === "receita_operacional");
  const receitaTotal = receitaOperacional
    ? Object.values(receitaOperacional.monthlyTotals).reduce((s, v) => s + v, 0)
    : 0;

  const colCount = periods.length + 2 + (showVerticalAnalysis ? 1 : 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse table-fixed" style={{ minWidth: `${200 + (colCount - 1) * 110}px` }}>
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left text-xs font-medium text-muted-foreground p-2 pl-3" style={{ width: 240 }}>
              Conta
            </th>
            {periods.map((p) => (
              <th key={p} className="text-right text-xs font-medium text-muted-foreground p-2" style={{ width: 110 }}>
                {getPeriodLabel(p)}
              </th>
            ))}
            <th className="text-right text-xs font-bold text-muted-foreground p-2 pr-2" style={{ width: 120 }}>
              Total
            </th>
            {showVerticalAnalysis && (
              <th className="text-right text-xs font-medium text-muted-foreground p-2 pr-3" style={{ width: 70 }}>
                AV %
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const style = getSectionStyle(section);
            const grand = Object.values(section.monthlyTotals).reduce((s, v) => s + v, 0);
            const hasCategories = section.categoryRows.length > 0;
            const isOpen = openSections.has(section.key);
            const rowCounter = useRef(0);
            rowCounter.current = 0;

            // Display values: for subtraction sections, show negative
            const displaySign = section.sign === "-" ? -1 : 1;

            return (
              <Fragment key={section.key}>
                <tr
                  className={style.row}
                  onClick={() => hasCategories && toggleSection(section.key)}
                >
                  <td className="text-xs py-2 pl-3 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {hasCategories ? (
                        isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      {section.label}
                    </span>
                  </td>
                  {periods.map((p) => (
                    <td key={p} className="text-right text-xs py-2 tabular-nums">
                      {fmt((section.monthlyTotals[p] || 0) * displaySign)}
                    </td>
                  ))}
                  <td className="text-right text-xs py-2 pr-2 tabular-nums font-bold">
                    {fmt(grand * displaySign)}
                  </td>
                  {showVerticalAnalysis && (
                    <td className="text-right text-xs py-2 pr-3 tabular-nums text-muted-foreground">
                      {receitaTotal > 0 ? fmtPct((grand * displaySign / receitaTotal) * 100) : "-"}
                    </td>
                  )}
                </tr>
                {hasCategories && isOpen && (
                  <CategoryRows
                    rows={section.categoryRows}
                    periods={periods}
                    level={1}
                    expanded={expanded}
                    toggle={toggle}
                    colorClass={style.color}
                    rowCounter={rowCounter}
                    receitaTotal={receitaTotal}
                    showPct={showVerticalAnalysis}
                  />
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
