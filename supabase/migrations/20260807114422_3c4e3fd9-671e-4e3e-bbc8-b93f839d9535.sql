CREATE TABLE public.backup_categorias_contexto_20260807 AS
SELECT c.*, now() AS backed_up_at
FROM public.categories c
JOIN public.categories p ON p.id = c.parent_id
WHERE coalesce(c.company_id::text,'null') <> coalesce(p.company_id::text,'null');

GRANT ALL ON public.backup_categorias_contexto_20260807 TO service_role;

ALTER TABLE public.backup_categorias_contexto_20260807 ENABLE ROW LEVEL SECURITY;