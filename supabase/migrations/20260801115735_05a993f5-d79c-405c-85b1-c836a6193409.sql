CREATE TABLE IF NOT EXISTS public.backup_simoespaula_categorias_20260801 (
  id uuid PRIMARY KEY,
  category text,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.backup_simoespaula_categorias_20260801 TO service_role;

ALTER TABLE public.backup_simoespaula_categorias_20260801 ENABLE ROW LEVEL SECURITY;

INSERT INTO public.backup_simoespaula_categorias_20260801 (id, category)
SELECT t.id, t.category
FROM public.transactions t
WHERE t.user_id = '0b1eb160-7199-4965-928e-e5f929b31c55'
  AND t.created_at >= '2026-07-30'
ON CONFLICT (id) DO NOTHING;

WITH alvo AS (
  SELECT t.id, t.category, t.type
  FROM public.transactions t
  WHERE t.user_id = '0b1eb160-7199-4965-928e-e5f929b31c55'
    AND t.created_at >= '2026-07-30'
    AND t.category IS NOT NULL
    AND t.category !~ '^[0-9a-f]{8}-'
),
escolha AS (
  SELECT DISTINCT ON (a.id) a.id, c.id AS cat_id
  FROM alvo a
  JOIN public.categories c
    ON c.user_id = '0b1eb160-7199-4965-928e-e5f929b31c55'
   AND c.company_id IS NULL
   AND upper(trim(c.name)) = upper(trim(a.category))
  ORDER BY a.id,
    (c.parent_id IS NULL) DESC,
    (c.type = a.type::text) DESC,
    c.created_at ASC
)
UPDATE public.transactions t
SET category = e.cat_id::text
FROM escolha e
WHERE t.id = e.id
  AND t.user_id = '0b1eb160-7199-4965-928e-e5f929b31c55';