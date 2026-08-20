export interface CategoryNodeLike {
  id: string;
  name: string;
  parent_id?: string | null;
  sort_order?: number | null;
}

export interface FlatCategoryOption {
  id: string;
  /** Full path label, e.g. "Operacionais › Eventos" */
  name: string;
  /** Leaf name only */
  leafName: string;
  depth: number;
}

/**
 * Flattens the category tree in hierarchical order, exposing the full path
 * as `name` so that search matches both parent and child names.
 */
export function flattenCategoryOptions(
  categories: CategoryNodeLike[],
): FlatCategoryOption[] {
  const byParent = new Map<string, CategoryNodeLike[]>();
  for (const cat of categories) {
    const key = cat.parent_id ?? "__root__";
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
  }

  const out: FlatCategoryOption[] = [];
  const walk = (parentKey: string, depth: number, prefix: string) => {
    if (depth > 5) return;
    for (const cat of byParent.get(parentKey) ?? []) {
      const path = prefix ? `${prefix} › ${cat.name}` : cat.name;
      out.push({ id: cat.id, name: path, leafName: cat.name, depth });
      walk(cat.id, depth + 1, path);
    }
  };
  walk("__root__", 0, "");
  return out;
}

/** Returns the category id plus every descendant id (recursively). */
export function collectCategoryBranchIds(
  categories: CategoryNodeLike[],
  rootId: string,
): string[] {
  const byParent = new Map<string, CategoryNodeLike[]>();
  for (const cat of categories) {
    if (!cat.parent_id) continue;
    const list = byParent.get(cat.parent_id) ?? [];
    list.push(cat);
    byParent.set(cat.parent_id, list);
  }
  const ids: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    for (const child of byParent.get(id) ?? []) stack.push(child.id);
  }
  return ids;
}
