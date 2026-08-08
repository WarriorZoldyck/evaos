CREATE OR REPLACE FUNCTION public.enforce_category_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent public.categories;
  _company_owner uuid;
  _cursor uuid;
  _depth integer := 0;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Uma categoria não pode ser pai dela mesma.' USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO _parent FROM public.categories WHERE id = NEW.parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Categoria pai não encontrada.' USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF _parent.user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'A categoria pai e a subcategoria precisam pertencer ao mesmo proprietário.' USING ERRCODE = 'check_violation';
    END IF;

    NEW.company_id := _parent.company_id;
    _cursor := NEW.parent_id;

    WHILE _cursor IS NOT NULL LOOP
      _depth := _depth + 1;
      IF _depth > 2 THEN
        RAISE EXCEPTION 'Categorias aceitam no máximo três níveis.' USING ERRCODE = 'check_violation';
      END IF;
      IF _cursor = NEW.id THEN
        RAISE EXCEPTION 'A movimentação criaria um ciclo de categorias.' USING ERRCODE = 'check_violation';
      END IF;
      SELECT parent_id INTO _cursor FROM public.categories WHERE id = _cursor;
    END LOOP;
  END IF;

  IF NEW.company_id IS NOT NULL THEN
    SELECT user_id INTO _company_owner FROM public.companies WHERE id = NEW.company_id;
    IF _company_owner IS NULL THEN
      RAISE EXCEPTION 'Empresa da categoria não encontrada.' USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF _company_owner IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'A empresa e a categoria precisam pertencer ao mesmo proprietário.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_category_integrity() FROM PUBLIC, anon, authenticated;