-- Family logins with roles (member | admin). Existing Neon admins are copied in.
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  display_name text,
  person_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT app_users_email_unique UNIQUE (email),
  CONSTRAINT app_users_role_check CHECK (role IN ('member', 'admin'))
);

CREATE INDEX IF NOT EXISTS app_users_email_idx ON app_users (email);
CREATE INDEX IF NOT EXISTS app_users_role_idx ON app_users (role);

INSERT INTO app_users (id, email, password_hash, role, created_at, last_login_at)
SELECT id, email, password_hash, 'admin', created_at, last_login_at
FROM admin_users
ON CONFLICT (email) DO NOTHING;
