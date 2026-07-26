/**
 * Utilities to resolve hierarchical category chains by ID rather than by name.
 * Prevents subtrees from disappearing when different branches share a name.
 */

export interface CategoryFlat {
  id: string;
  name: string;
  parent_id: string | null;
  type: string | null;
}

export interface CategoryIndex {
  byId: Map<string, CategoryFlat>;
  byParent: Map<string | null, CategoryFlat[]>;
  /** All categories that share a given normalized name, grouped for fast lookup. */
  byName: Map<string, CategoryFlat[]>;
}

const norm = (s: string) =>
  (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function buildCategoryIndex(categories: CategoryFlat[]): CategoryIndex {
  const byId = new Map<string, CategoryFlat>();
  const byParent = new Map<string | null, CategoryFlat[]>();
  const byName = new Map<string, CategoryFlat[]>();
  for (const c of categories) {
    byId.set(c.id, c);
    const arr = byParent.get(c.parent_id) || [];
    arr.push(c);
    byParent.set(c.parent_id, arr);
    const k = norm(c.name);
    const nArr = byName.get(k) || [];
    nArr.push(c);
    byName.set(k, nArr);
  }
  return { byId, byParent, byName };
}

export interface ChainNames {
  category?: string;
  subcategory?: string;
  subcategory2?: string;
}

export interface ChainIds {
  rootId: string | null;
  subId: string | null;
  sub2Id: string | null;
}

/**
 * Given the chain of names, resolve which concrete category IDs the user meant,
 * preferring the branch that fully matches sub/sub2 when several roots share a name.
 */
export function resolveChain(
  chain: ChainNames,
  index: CategoryIndex,
): ChainIds {
  const rootName = chain.category ? norm(chain.category) : "";
  const subName = chain.subcategory ? norm(chain.subcategory) : "";
  const sub2Name = chain.subcategory2 ? norm(chain.subcategory2) : "";

  if (!rootName) return { rootId: null, subId: null, sub2Id: null };

  const rootCandidates = (index.byName.get(rootName) || []).filter(
    (c) => c.parent_id === null,
  );
  if (rootCandidates.length === 0) return { rootId: null, subId: null, sub2Id: null };

  let bestRoot: CategoryFlat | null = null;
  let bestSub: CategoryFlat | null = null;
  let bestSub2: CategoryFlat | null = null;
  let bestScore = -1;

  for (const root of rootCandidates) {
    let score = 1;
    let sub: CategoryFlat | null = null;
    let sub2: CategoryFlat | null = null;

    if (subName) {
      const subChildren = (index.byParent.get(root.id) || []).filter(
        (c) => norm(c.name) === subName,
      );
      if (subChildren.length > 0) {
        score += 2;
        sub = subChildren[0]!;
        if (sub2Name) {
          const sub2Children = (index.byParent.get(sub.id) || []).filter(
            (c) => norm(c.name) === sub2Name,
          );
          if (sub2Children.length > 0) {
            score += 4;
            sub2 = sub2Children[0]!;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRoot = root;
      bestSub = sub;
      bestSub2 = sub2;
    }
  }

  return {
    rootId: bestRoot?.id ?? null,
    subId: bestSub?.id ?? null,
    sub2Id: bestSub2?.id ?? null,
  };
}

export function childrenOfId(
  index: CategoryIndex,
  parentId: string | null,
): CategoryFlat[] {
  return index.byParent.get(parentId) || [];
}
