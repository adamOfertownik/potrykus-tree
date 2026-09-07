ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS member_invite_hash TEXT,
  ADD COLUMN IF NOT EXISTS admin_invite_hash TEXT,
  ADD COLUMN IF NOT EXISTS family_view_hash TEXT,
  ADD COLUMN IF NOT EXISTS member_invite_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_invite_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS family_view_updated_at timestamptz;

UPDATE app_settings
SET
  member_invite_hash = COALESCE(member_invite_hash, invite_code_hash),
  member_invite_updated_at = COALESCE(member_invite_updated_at, invite_updated_at)
WHERE id = 'default';
