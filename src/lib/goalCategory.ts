import { supabase } from "@/integrations/supabase/client";

/** Nome da categoria raiz onde ficam as subcategorias de objetivos. */
export const GOALS_ROOT_CATEGORY = "Metas";

const norm = (s: string) =>
  (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function findCategory(
  userId: string,
  companyId: string | null,
  name: string,
  parentId: string | null,
): Promise<{ id: string; name: string } | null> {
  let q = supabase
    .from("categories")
    .select("id,name,parent_id,company_id")
    .eq("user_id", userId);
  if (parentId) q = q.eq("parent_id", parentId);
  else q = q.is("parent_id", null);
  if (companyId) q = q.eq("company_id", companyId);
  else q = q.is("company_id", null);

  const { data } = await q;
  const match = (data || []).find((c: any) => norm(c.name) === norm(name));
  return match ? { id: match.id, name: match.name } : null;
}

/**
 * Garante que exista a categoria raiz "Metas" e uma subcategoria com o nome do objetivo,
 * no contexto (Pessoal / Empresa) informado. Retorna o id da subcategoria.
 */
export async function ensureGoalCategory(
  userId: string,
  companyId: string | null,
  goalName: string,
): Promise<string | null> {
  const name = (goalName || "").trim();
  if (!userId || !name) return null;

  let root = await findCategory(userId, companyId, GOALS_ROOT_CATEGORY, null);
  if (!root) {
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: GOALS_ROOT_CATEGORY,
        parent_id: null,
        type: "ambos",
        user_id: userId,
        company_id: companyId,
        sort_order: 999,
      } as any)
      .select("id,name")
      .maybeSingle();
    if (error || !data) return null;
    root = { id: (data as any).id, name: (data as any).name };
  }

  const existing = await findCategory(userId, companyId, name, root.id);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name,
      parent_id: root.id,
      type: "ambos",
      user_id: userId,
      // O contexto de um filho é resolvido pelo banco a partir do parent_id.
      company_id: null,
      sort_order: 0,
    } as any)
    .select("id")
    .maybeSingle();

  if (error || !data) return null;
  return (data as any).id;
}

/** Renomeia a subcategoria do objetivo quando a meta muda de nome. */
export async function renameGoalCategory(
  userId: string,
  companyId: string | null,
  oldName: string,
  newName: string,
): Promise<void> {
  if (!userId || !oldName || !newName || norm(oldName) === norm(newName)) return;
  const root = await findCategory(userId, companyId, GOALS_ROOT_CATEGORY, null);
  if (!root) return;
  const sub = await findCategory(userId, companyId, oldName, root.id);
  if (!sub) return;
  await supabase.from("categories").update({ name: newName.trim() } as any).eq("id", sub.id);
}

/**
 * Soma, por nome de objetivo, o que já foi transferido para as metas:
 * lançamentos de RECEITA categorizados em "Metas > [objetivo]" (a perna de entrada
 * da transferência entre contas). Transferências internas seguem fora do faturamento/DRE.
 */
export async function fetchGoalLinkedAmounts(
  userId: string,
  companyId: string | null,
  goalNames: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (!userId || goalNames.length === 0) return result;

  let q = supabase
    .from("transactions")
    .select("amount,subcategory,type,category")
    .eq("user_id", userId)
    .eq("type", "receita")
    .eq("category", GOALS_ROOT_CATEGORY)
    .in("subcategory", goalNames);
  if (companyId) q = q.eq("company_id", companyId);
  else q = q.is("company_id", null);

  const { data } = await q;
  for (const row of (data || []) as any[]) {
    const key = row.subcategory as string;
    result[key] = (result[key] || 0) + Number(row.amount || 0);
  }
  return result;
}
