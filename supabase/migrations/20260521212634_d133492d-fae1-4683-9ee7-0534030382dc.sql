
-- Allow invitees to see/manage their own pending invitations in workspace_members
CREATE POLICY "Invitee can read own pending invitation"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (auth.uid() = member_user_id AND status = 'pending');

CREATE POLICY "Invitee can accept own pending invitation"
ON public.workspace_members
FOR UPDATE
TO authenticated
USING (auth.uid() = member_user_id AND status = 'pending')
WITH CHECK (auth.uid() = member_user_id AND status IN ('active','pending'));

CREATE POLICY "Invitee can reject own pending invitation"
ON public.workspace_members
FOR DELETE
TO authenticated
USING (auth.uid() = member_user_id AND status = 'pending');
