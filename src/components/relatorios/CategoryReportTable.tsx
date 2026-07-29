import { useState, Fragment, useRef } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
export interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  total: number;
  children: CategoryGroup[];
}

interface Props {
  revenueGroups: CategoryGroup[];
  expenseGroups: CategoryGroup[];
  totalRevenue: number;
  totalExpense: number;
  result: number;
  loading: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const INDENT_PX = 20;

function CategoryRows({
  groups,
  level,
  colorClass,
  expanded,
  toggle,
  rowCounter,
}: {
  groups: CategoryGroup[];
  level: number;
  colorClass: string;
  expanded: Set<string>;
  toggle: (id: string) => void;
  rowCounter: { current: number };
}) {
  return (
    <>
      {groups.map((g) => {
        const isOpen = expanded.has(g.categoryId);
        const hasChildren = g.children.length > 0;
        const idx = rowCounter.current++;
        const isEven = idx % 2 === 0;

        return (
          <Fragment key={g.categoryId}>
            <tr
              className={cn(
                hasChildren ? "cursor-pointer font-medium" : "cursor-default",
                isEven ? "bg-muted/30" : "",
                "hover:bg-muted/50 border-b border-border/30"
              )}
              onClick={() => hasChildren && toggle(g.categoryId)}
            >
              <td
                className="whitespace-nowrap text-xs py-2"
                style={{ paddingLeft: 12 + level * INDENT_PX }}
              >
                <span className="flex items-center gap-1">
                  {hasChildren ? (
                    isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  {g.categoryName.toUpperCase()}
                </span>
              </td>
              <td className={cn("text-right text-xs py-2 pr-3 tabular-nums font-semibold", colorClass)}>
                {fmt(g.total)}
              </td>
            </tr>

            {isOpen && hasChildren && (
              <CategoryRows
                groups={g.children}
                level={level + 1}
                colorClass={colorClass}
                expanded={expanded}
                toggle={toggle}
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
  total,
  groups,
  expanded,
  toggle,
  toggleSection,
  isSectionOpen,
  sectionClassName,
  colorClass,
}: {
  sectionId: string;
  label: string;
  total: number;
  groups: CategoryGroup[];
  expanded: Set<string>;
  toggle: (id: string) => void;
  toggleSection: (id: string) => void;
  isSectionOpen: boolean;
  sectionClassName: string;
  colorClass: string;
}) {
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
            {isSectionOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            {label}
          </span>
        </td>
        <td className="text-right text-xs py-2 pr-3 tabular-nums font-bold">
          {fmt(total)}
        </td>
      </tr>
      {isSectionOpen && (
        <CategoryRows
          groups={groups}
          level={1}
          colorClass={colorClass}
          expanded={expanded}
          toggle={toggle}
          rowCounter={rowCounter}
        />
      )}
    </>
  );
}

export function CategoryReportTable({
  revenueGroups,
  expenseGroups,
  totalRevenue,
  totalExpense,
  result,
  loading,
}: Props) {
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left text-xs font-medium text-muted-foreground p-2 pl-3">Categoria</th>
            <th className="text-right text-xs font-medium text-muted-foreground p-2 pr-3" style={{ width: 140 }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          <SectionBlock
            sectionId="__revenue__"
            label="(+) RECEITAS"
            total={totalRevenue}
            groups={revenueGroups}
            expanded={expanded}
            toggle={toggle}
            toggleSection={toggleSection}
            isSectionOpen={sections.has("__revenue__")}
            sectionClassName="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-b"
            colorClass="text-emerald-700 dark:text-emerald-400"
          />

          <SectionBlock
            sectionId="__expense__"
            label="(-) DESPESAS"
            total={-totalExpense}
            groups={expenseGroups}
            expanded={expanded}
            toggle={toggle}
            toggleSection={toggleSection}
            isSectionOpen={sections.has("__expense__")}
            sectionClassName="bg-destructive/10 text-destructive border-b"
            colorClass="text-destructive"
          />

          <tr
            className={cn(
              "font-bold border-t-2",
              result >= 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive"
            )}
          >
            <td className="text-xs py-2 pl-3 whitespace-nowrap">= RESULTADO</td>
            <td className="text-right text-xs py-2 pr-3 tabular-nums font-bold">{fmt(result)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
