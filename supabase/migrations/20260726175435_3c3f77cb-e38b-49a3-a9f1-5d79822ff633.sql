
-- 1) hub_audit_log: restrict INSERT to actor=self AND owner_id must be a valid hub relationship
DROP POLICY IF EXISTS "Authenticated can insert their own audit row" ON public.hub_audit_log;
CREATE POLICY "Authenticated can insert their own audit row"
ON public.hub_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = actor_user_id
  AND (
    owner_id = auth.uid()
    OR public.is_hub_member(auth.uid(), owner_id)
  )
);

-- 2) hub_member_can_see: fail closed on NULL resource_id
CREATE OR REPLACE FUNCTION public.hub_member_can_see(_member_uid uuid, _owner_uid uuid, _resource_type text, _resource_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN _resource_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.workspace_member_permissions wmp
        JOIN public.workspace_members wm ON wm.id = wmp.workspace_member_id
        WHERE wm.member_user_id = _member_uid
          AND wm.owner_id = _owner_uid
          AND wm.status = 'active'
          AND wmp.resource_type = _resource_type
          AND wmp.resource_id = _resource_id
      )
    END
$function$;

-- 3) profiles: drop broad hub-member SELECT policy and expose only safe columns via a view
DROP POLICY IF EXISTS "Hub members can read owner profile" ON public.profiles;

CREATE OR REPLACE VIEW public.hub_owner_profiles
WITH (security_invoker = false) AS
SELECT p.id, p.full_name, p.avatar_url
FROM public.profiles p
WHERE auth.uid() = p.id
   OR public.is_hub_member(auth.uid(), p.id);

GRANT SELECT ON public.hub_owner_profiles TO authenticated;
