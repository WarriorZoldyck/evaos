import { describe, it, expect } from "vitest";
import {
  buildCategoryIndex,
  resolveChain,
  childrenOfId,
  type CategoryFlat,
} from "./categoryChain";

const cats: CategoryFlat[] = [
  // Root A "Alimentação" with sub "Restaurante" > "Almoço"
  { id: "r1", name: "Alimentação", parent_id: null, type: "despesa" },
  { id: "r1s1", name: "Restaurante", parent_id: "r1", type: "despesa" },
  { id: "r1s1a", name: "Almoço", parent_id: "r1s1", type: "despesa" },
  // Duplicate root name with different subtree
  { id: "r2", name: "Alimentação", parent_id: null, type: "despesa" },
  { id: "r2s1", name: "Mercado", parent_id: "r2", type: "despesa" },
  // Unrelated
  { id: "r3", name: "Transporte", parent_id: null, type: "despesa" },
  { id: "r3s1", name: "Restaurante", parent_id: "r3", type: "despesa" }, // homônimo em outro ramo
];

describe("buildCategoryIndex", () => {
  it("indexes by id, parent and normalized name", () => {
    const idx = buildCategoryIndex(cats);
    expect(idx.byId.get("r1s1")?.name).toBe("Restaurante");
    expect(idx.byParent.get("r1")?.length).toBe(1);
    expect(idx.byParent.get(null)?.length).toBe(3);
    expect(idx.byName.get("alimentação")?.length).toBe(2);
    expect(idx.byName.get("restaurante")?.length).toBe(2);
  });
});

describe("resolveChain", () => {
  const idx = buildCategoryIndex(cats);

  it("returns nulls when nothing matches", () => {
    expect(resolveChain({ category: "Inexistente" }, idx)).toEqual({
      rootId: null,
      subId: null,
      sub2Id: null,
    });
  });

  it("resolves single-level chain", () => {
    const r = resolveChain({ category: "Transporte" }, idx);
    expect(r.rootId).toBe("r3");
    expect(r.subId).toBeNull();
  });

  it("picks the branch whose sub matches when roots share a name", () => {
    const a = resolveChain(
      { category: "Alimentação", subcategory: "Mercado" },
      idx,
    );
    expect(a.rootId).toBe("r2");
    expect(a.subId).toBe("r2s1");

    const b = resolveChain(
      { category: "Alimentação", subcategory: "Restaurante" },
      idx,
    );
    expect(b.rootId).toBe("r1");
    expect(b.subId).toBe("r1s1");
  });

  it("resolves full 3-level chain", () => {
    const r = resolveChain(
      {
        category: "Alimentação",
        subcategory: "Restaurante",
        subcategory2: "Almoço",
      },
      idx,
    );
    expect(r).toEqual({ rootId: "r1", subId: "r1s1", sub2Id: "r1s1a" });
  });

  it("is accent and case insensitive", () => {
    const r = resolveChain(
      { category: "alimentacao", subcategory: "MERCADO" },
      idx,
    );
    expect(r.rootId).toBe("r2");
    expect(r.subId).toBe("r2s1");
  });
});

describe("childrenOfId", () => {
  const idx = buildCategoryIndex(cats);
  it("returns direct children of a parent id", () => {
    expect(childrenOfId(idx, "r1").map((c) => c.id)).toEqual(["r1s1"]);
    expect(childrenOfId(idx, null).map((c) => c.id)).toEqual(["r1", "r2", "r3"]);
    expect(childrenOfId(idx, "does-not-exist")).toEqual([]);
  });
});
