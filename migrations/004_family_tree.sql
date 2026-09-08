-- Canonical family tree (one current document). Graph edits persist here.
CREATE TABLE IF NOT EXISTS family_tree (
  id text PRIMARY KEY DEFAULT 'current',
  meta jsonb NOT NULL,
  people jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_tree_singleton CHECK (id = 'current')
);
