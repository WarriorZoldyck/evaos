CREATE POLICY "Pending hub invitees can read owner profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.owner_id = profiles.id
      AND wm.member_user_id = auth.uid()
      AND wm.status = 'pending'
  )
);