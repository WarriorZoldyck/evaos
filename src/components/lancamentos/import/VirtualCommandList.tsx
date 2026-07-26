import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { CategoryFlat } from "@/components/lancamentos/CategoryPathCombobox";

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

interface VirtualCommandListProps {
  items: CategoryFlat[];
  search: string;
  selectedName: string;
  onPick: (name: string) => void;
  /** Threshold above which virtualization kicks in. */
  virtualizeAfter?: number;
  /** Row height estimate in px. */
  rowHeight?: number;
  /** Max height (px) of the scrollable container. */
  maxHeight?: number;
}

/**
 * Virtualized list of category options for use inside a cmdk `Command`.
 * Filters items in-memory (accent/case-insensitive) so the parent can use
 * `shouldFilter={false}` and keep cmdk from re-scanning every DOM node.
 */
export function VirtualCommandList({
  items,
  search,
  selectedName,
  onPick,
  virtualizeAfter = 50,
  rowHeight = 28,
  maxHeight = 260,
}: VirtualCommandListProps) {
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = normalize(search);
    return items.filter((i) => normalize(i.name).includes(q));
  }, [items, search]);

  const parentRef = useRef<HTMLDivElement | null>(null);

  const shouldVirtualize = filtered.length > virtualizeAfter;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? filtered.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  if (filtered.length === 0) return null;

  if (!shouldVirtualize) {
    return (
      <CommandGroup>
        {filtered.map((c) => (
          <CommandItem
            key={c.id}
            value={c.name}
            onSelect={() => onPick(c.name)}
            className="text-xs"
          >
            <Check
              className={cn(
                "mr-2 h-3 w-3",
                selectedName === c.name ? "opacity-100" : "opacity-0",
              )}
            />
            {c.name}
          </CommandItem>
        ))}
      </CommandGroup>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <CommandGroup>
      <div
        ref={parentRef}
        style={{ maxHeight, overflowY: "auto" }}
        className="w-full"
      >
        <div style={{ height: totalSize, width: "100%", position: "relative" }}>
          {virtualItems.map((v) => {
            const c = filtered[v.index];
            if (!c) return null;
            return (
              <div
                key={c.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${v.start}px)`,
                }}
              >
                <CommandItem
                  value={c.name}
                  onSelect={() => onPick(c.name)}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      selectedName === c.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {c.name}
                </CommandItem>
              </div>
            );
          })}
        </div>
      </div>
    </CommandGroup>
  );
}
