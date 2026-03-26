
-- workspace_members: links owner to managed member accounts
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  member_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own members
CREATE POLICY "Owners can manage their workspace members"
  ON public.workspace_members FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Members can read their own membership record
CREATE POLICY "Members can view their own membership"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (auth.uid() = member_user_id);

-- workspace_member_permissions: granular resource access
CREATE TABLE public.workspace_member_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_member_id uuid NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL
);

ALTER TABLE public.workspace_member_permissions ENABLE ROW LEVEL SECURITY;

-- Owner can manage permissions via join
CREATE POLICY "Owners can manage member permissions"
  ON public.workspace_member_permissions FOR ALL
  TO authenticated
  USING (
    workspace_member_id IN (
      SELECT id FROM public.workspace_members WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_member_id IN (
      SELECT id FROM public.workspace_members WHERE owner_id = auth.uid()
    )
  );

-- Members can read their own permissions
CREATE POLICY "Members can view their own permissions"
  ON public.workspace_member_permissions FOR SELECT
  TO authenticated
  USING (
    workspace_member_id IN (
      SELECT id FROM public.workspace_members WHERE member_user_id = auth.uid()
    )
  );

-- Security definer function to check hub membership
CREATE OR REPLACE FUNCTION public.is_hub_member(_member_uid uuid, _owner_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE member_user_id = _member_uid
      AND owner_id = _owner_uid
      AND status = 'active'
  )
$$;
