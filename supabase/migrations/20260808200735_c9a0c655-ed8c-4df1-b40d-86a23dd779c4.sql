CREATE TABLE public.backup_categories_integrity_20260808 (
  LIKE public.categories INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY
);
ALTER TABLE public.backup_categories_integrity_20260808 ADD COLUMN backed_up_at timestamptz NOT NULL DEFAULT now();
GRANT ALL ON public.backup_categories_integrity_20260808 TO service_role;
ALTER TABLE public.backup_categories_integrity_20260808 ENABLE ROW LEVEL SECURITY;

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
  IF NEW.company_id IS NOT NULL THEN
    SELECT user_id INTO _company_owner
    FROM public.companies
    WHERE id = NEW.company_id;

    IF _company_owner IS NULL THEN
      RAISE EXCEPTION 'Empresa da categoria não encontrada.' USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF _company_owner IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'A empresa e a categoria precisam pertencer ao mesmo proprietário.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Uma categoria não pode ser pai dela mesma.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO _parent
  FROM public.categories
  WHERE id = NEW.parent_id;

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

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_category_integrity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS categories_enforce_integrity ON public.categories;

INSERT INTO public.backup_categories_integrity_20260808
SELECT c.*, now()
FROM public.categories c
WHERE (c.company_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.companies co WHERE co.id = c.company_id AND co.user_id IS DISTINCT FROM c.user_id
)) OR (c.parent_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.categories p WHERE p.id = c.parent_id
));

UPDATE public.categories c
SET user_id = co.user_id
FROM public.companies co
WHERE co.id = c.company_id
  AND co.user_id IS DISTINCT FROM c.user_id;

CREATE TRIGGER categories_enforce_integrity
BEFORE INSERT OR UPDATE OF user_id, company_id, parent_id
ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.enforce_category_integrity();

UPDATE public.categories c
SET parent_id = NULL
WHERE c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.categories p WHERE p.id = c.parent_id);

ALTER TABLE public.categories DROP CONSTRAINT categories_parent_id_fkey;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE RESTRICT;

ALTER TABLE public.categories DROP CONSTRAINT categories_company_id_fkey;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.prevent_company_delete_with_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _links text[] := ARRAY[]::text[];
BEGIN
  IF EXISTS (SELECT 1 FROM public.categories WHERE company_id = OLD.id) THEN _links := array_append(_links, 'categorias'); END IF;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE company_id = OLD.id) THEN _links := array_append(_links, 'lançamentos'); END IF;
  IF EXISTS (SELECT 1 FROM public.recurring_transactions WHERE company_id = OLD.id) THEN _links := array_append(_links, 'recorrências'); END IF;
  IF EXISTS (SELECT 1 FROM public.bank_accounts WHERE company_id = OLD.id) THEN _links := array_append(_links, 'contas bancárias'); END IF;
  IF EXISTS (SELECT 1 FROM public.credit_cards WHERE company_id = OLD.id) THEN _links := array_append(_links, 'cartões'); END IF;
  IF EXISTS (SELECT 1 FROM public.wallets WHERE company_id = OLD.id) THEN _links := array_append(_links, 'carteiras'); END IF;
  IF EXISTS (SELECT 1 FROM public.card_terminals WHERE company_id = OLD.id) THEN _links := array_append(_links, 'maquininhas'); END IF;
  IF EXISTS (SELECT 1 FROM public.clients WHERE company_id = OLD.id) THEN _links := array_append(_links, 'clientes'); END IF;
  IF EXISTS (SELECT 1 FROM public.suppliers WHERE company_id = OLD.id) THEN _links := array_append(_links, 'fornecedores'); END IF;
  IF EXISTS (SELECT 1 FROM public.goals WHERE company_id = OLD.id) THEN _links := array_append(_links, 'metas'); END IF;
  IF EXISTS (SELECT 1 FROM public.pricing_v2_configurations WHERE company_id = OLD.id) OR EXISTS (SELECT 1 FROM public.pricing_v2_cost_items WHERE company_id = OLD.id) OR EXISTS (SELECT 1 FROM public.pricing_v2_procedures WHERE company_id = OLD.id) THEN _links := array_append(_links, 'precificação'); END IF;

  IF cardinality(_links) > 0 THEN
    RAISE EXCEPTION 'Esta empresa ainda possui dados vinculados: %. Remova ou transfira esses dados antes de excluir.', array_to_string(_links, ', ') USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_company_delete_with_data() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS companies_prevent_delete_with_data ON public.companies;
CREATE TRIGGER companies_prevent_delete_with_data
BEFORE DELETE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.prevent_company_delete_with_data();