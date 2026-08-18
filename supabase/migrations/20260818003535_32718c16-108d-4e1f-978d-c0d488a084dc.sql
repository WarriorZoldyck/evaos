
DO $$
DECLARE
  v_user uuid := 'b049592f-d97a-468d-a839-ed02c2a41d9b';
  v_co   uuid := 'cb0f2473-6637-4437-92f6-e0544b051c72';
BEGIN
  CREATE TABLE IF NOT EXISTS public.backup_renato_ctx_20260818 AS
  SELECT c.*, now() AS backed_up_at FROM public.categories c WHERE c.user_id = v_user WITH NO DATA;

  INSERT INTO public.backup_renato_ctx_20260818
  SELECT c.*, now() FROM public.categories c WHERE c.user_id = v_user;

  CREATE TEMP TABLE needed AS
  WITH RECURSIVE used AS (
    SELECT DISTINCT t.category::uuid AS id
    FROM public.transactions t
    WHERE t.user_id = v_user AND t.company_id = v_co
      AND t.category ~ '^[0-9a-fA-F-]{36}$'
  ), chain AS (
    SELECT c.* FROM public.categories c JOIN used u ON u.id = c.id
    UNION
    SELECT p.* FROM public.categories p JOIN chain ch ON ch.parent_id = p.id
  )
  SELECT * FROM chain WHERE company_id IS DISTINCT FROM v_co;

  CREATE TEMP TABLE map AS
  SELECT id AS old_id, gen_random_uuid() AS new_id FROM needed;

  -- clone level by level (parents first)
  WITH RECURSIVE lvl AS (
    SELECT n.*, 0 AS depth FROM needed n WHERE n.parent_id IS NULL OR n.parent_id NOT IN (SELECT old_id FROM map)
    UNION ALL
    SELECT n.*, l.depth + 1 FROM needed n JOIN lvl l ON n.parent_id = l.id
  )
  INSERT INTO public.categories (id, user_id, name, company_id, parent_id, type, dre_section, sort_order)
  SELECT m.new_id, v_user, l.name, v_co,
         (SELECT m2.new_id FROM map m2 WHERE m2.old_id = l.parent_id),
         l.type, l.dre_section, l.sort_order
  FROM lvl l JOIN map m ON m.old_id = l.id
  ORDER BY l.depth;

  UPDATE public.transactions t
  SET category = m.new_id::text
  FROM map m
  WHERE t.user_id = v_user AND t.company_id = v_co AND t.category = m.old_id::text;
END $$;
