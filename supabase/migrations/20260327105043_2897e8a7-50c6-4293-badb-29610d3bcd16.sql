
-- Create workspaces table
CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Owner can CRUD their own workspaces
CREATE POLICY "Owners can manage their workspaces"
  ON public.workspaces FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Add workspace_id column to workspace_members BEFORE referencing it in policy
ALTER TABLE public.workspace_members
  ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Members can view workspaces they belong to
CREATE POLICY "Members can view linked workspaces"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.member_user_id = auth.uid() AND wm.status = 'active'
      AND wm.workspace_id IS NOT NULL
    )
  );
