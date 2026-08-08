INSERT INTO public.backup_categories_integrity_20260808
SELECT c.*, now()
FROM public.categories c
JOIN (
  SELECT user_id, company_id, parent_id, lower(trim(name)) AS normalized_name
  FROM public.categories
  GROUP BY user_id, company_id, parent_id, lower(trim(name))
  HAVING count(*) > 1
) d ON d.user_id = c.user_id
   AND d.company_id IS NOT DISTINCT FROM c.company_id
   AND d.parent_id IS NOT DISTINCT FROM c.parent_id
   AND d.normalized_name = lower(trim(c.name))
WHERE NOT EXISTS (SELECT 1 FROM public.backup_categories_integrity_20260808 b WHERE b.id = c.id);

DO $$
DECLARE
  _duplicate uuid;
  _keeper uuid;
BEGIN
  SELECT c.id, d.keep_id INTO _duplicate, _keeper
  FROM public.categories c
  JOIN (
    SELECT user_id, company_id, parent_id, lower(trim(name)) normalized_name, min(id::text)::uuid keep_id
    FROM public.categories
    GROUP BY user_id, company_id, parent_id, lower(trim(name))
    HAVING count(*) > 1
  ) d ON d.user_id=c.user_id AND d.company_id IS NOT DISTINCT FROM c.company_id AND d.parent_id IS NOT DISTINCT FROM c.parent_id AND d.normalized_name=lower(trim(c.name))
  WHERE c.id<>d.keep_id AND c.name='Estacionamento'
  LIMIT 1;
  IF _duplicate IS NOT NULL THEN
    UPDATE public.transactions SET category=_keeper::text WHERE category=_duplicate::text;
    UPDATE public.transactions SET subcategory=_keeper::text WHERE subcategory=_duplicate::text;
    UPDATE public.transactions SET subcategory2=_keeper::text WHERE subcategory2=_duplicate::text;
    UPDATE public.recurring_transactions SET category=_keeper::text WHERE category=_duplicate::text;
    UPDATE public.recurring_transactions SET subcategory=_keeper::text WHERE subcategory=_duplicate::text;
    UPDATE public.recurring_transactions SET subcategory2=_keeper::text WHERE subcategory2=_duplicate::text;
    DELETE FROM public.categories WHERE id=_duplicate;
  END IF;

  SELECT c.id, d.keep_id INTO _duplicate, _keeper
  FROM public.categories c
  JOIN (
    SELECT user_id, company_id, parent_id, lower(trim(name)) normalized_name, min(id::text)::uuid keep_id
    FROM public.categories
    GROUP BY user_id, company_id, parent_id, lower(trim(name))
    HAVING count(*) > 1
  ) d ON d.user_id=c.user_id AND d.company_id IS NOT DISTINCT FROM c.company_id AND d.parent_id IS NOT DISTINCT FROM c.parent_id AND d.normalized_name=lower(trim(c.name))
  WHERE c.id<>d.keep_id AND c.name='IOF'
  LIMIT 1;
  IF _duplicate IS NOT NULL THEN
    UPDATE public.transactions SET category=_keeper::text WHERE category=_duplicate::text;
    UPDATE public.transactions SET subcategory=_keeper::text WHERE subcategory=_duplicate::text;
    UPDATE public.transactions SET subcategory2=_keeper::text WHERE subcategory2=_duplicate::text;
    UPDATE public.recurring_transactions SET category=_keeper::text WHERE category=_duplicate::text;
    UPDATE public.recurring_transactions SET subcategory=_keeper::text WHERE subcategory=_duplicate::text;
    UPDATE public.recurring_transactions SET subcategory2=_keeper::text WHERE subcategory2=_duplicate::text;
    DELETE FROM public.categories WHERE id=_duplicate;
  END IF;
END $$;