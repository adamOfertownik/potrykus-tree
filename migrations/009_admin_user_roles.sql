-- Roles for admin panel accounts: full admin vs editor (no user CRUD)
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'editor'));
