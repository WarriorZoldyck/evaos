CREATE POLICY "Members can leave by themselves"
ON public.workspace_members
FOR DELETE TO authenticated
USING (auth.uid() = member_user_id);