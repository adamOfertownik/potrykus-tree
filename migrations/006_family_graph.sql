-- Family tree JSON lives in Neon, not in git.
CREATE TABLE IF NOT EXISTS family_graph (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_graph_singleton CHECK (id = 'default')
);
