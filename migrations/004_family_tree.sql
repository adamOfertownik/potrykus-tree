-- Canonical family tree document (replaces write-to-disk on Vercel)
CREATE TABLE IF NOT EXISTS family_tree (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_admin_id uuid
);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_admin_id uuid;
