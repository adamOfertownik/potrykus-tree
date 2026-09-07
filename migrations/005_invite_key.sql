-- One-row settings: family invite key is stored as bcrypt hash only.
CREATE TABLE IF NOT EXISTS app_settings (
  id text PRIMARY KEY,
  invite_code_hash text,
  invite_updated_at timestamptz,
  CONSTRAINT app_settings_singleton CHECK (id = 'default')
);

INSERT INTO app_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;
