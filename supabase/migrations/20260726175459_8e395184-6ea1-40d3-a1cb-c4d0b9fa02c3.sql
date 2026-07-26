
DROP VIEW IF EXISTS public.hub_owner_profiles;

CREATE OR REPLACE FUNCTION public.get_hub_owner_profile(_owner_id uuid)
RETURNS TABLE (id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = _owner_id
    AND (auth.uid() = p.id OR public.is_hub_member(auth.uid(), p.id));
$$;

GRANT EXECUTE ON FUNCTION public.get_hub_owner_profile(uuid) TO authenticated;
