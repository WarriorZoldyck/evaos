-- Add flag to distinguish members CREATED BY the hub (new auth users)
-- vs members invited (pre-existing EVA accounts). Only the former allow
-- the owner to reset their password.
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS created_by_hub boolean NOT NULL DEFAULT false;

-- Backfill: a member is "created by hub" ONLY if the underlying auth.users row
-- has app_metadata.hub_member = true AND app_metadata.owner_id matches this
-- workspace owner. Anything else is treated as a pre-existing user (safe default).
UPDATE public.workspace_members wm
SET created_by_hub = true
FROM auth.users u
WHERE u.id = wm.member_user_id
  AND (u.raw_app_meta_data->>'hub_member')::boolean IS TRUE
  AND (u.raw_app_meta_data->>'owner_id')::uuid = wm.owner_id;
