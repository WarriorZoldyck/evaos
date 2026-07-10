
-- Fix mutable search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END
$$;

-- Fix hub_member_can_see to fail closed: when a member exists but has no
-- explicit permissions rows, deny access instead of granting full visibility.
CREATE OR REPLACE FUNCTION public.hub_member_can_see(_member_uid uuid, _owner_uid uuid, _resource_type text, _resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    CASE
      WHEN _resource_id IS NULL THEN true
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
$$;
