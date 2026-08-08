CREATE OR REPLACE FUNCTION public.propagate_category_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN
    RETURN NEW;
  END IF;

  WITH RECURSIVE descendants AS (
    SELECT id FROM public.categories WHERE parent_id = NEW.id
    UNION ALL
    SELECT c.id FROM public.categories c JOIN descendants d ON c.parent_id = d.id
  )
  UPDATE public.categories c
  SET company_id = NEW.company_id
  FROM descendants d
  WHERE c.id = d.id
    AND c.company_id IS DISTINCT FROM NEW.company_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.propagate_category_context() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS categories_propagate_context ON public.categories;
CREATE TRIGGER categories_propagate_context
AFTER UPDATE OF company_id ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.propagate_category_context();