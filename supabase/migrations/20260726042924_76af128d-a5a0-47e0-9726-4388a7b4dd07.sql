
DROP POLICY IF EXISTS "Pending hub invitees can read owner profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_pending_invitation_owner_name(_owner_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name
  FROM public.profiles p
  WHERE p.id = _owner_id
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.owner_id = _owner_id
        AND wm.member_user_id = auth.uid()
        AND wm.status = 'pending'
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_invitation_owner_name(uuid) TO authenticated;
