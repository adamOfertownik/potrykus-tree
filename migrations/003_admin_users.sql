-- Admin accounts for approving family submissions
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT admin_users_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (email);
