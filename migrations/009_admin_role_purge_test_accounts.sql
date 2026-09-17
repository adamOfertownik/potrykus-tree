-- Payments-only accounts (ciocia) + remove leftover CRUD test logins.
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'pay'));

DELETE FROM admin_users
WHERE lower(split_part(email, '@', 1)) LIKE 'crud.%'
   OR lower(split_part(email, '@', 2)) IN (
     'example.com', 'example.org', 'example.net', 'localhost'
   )
   OR lower(split_part(email, '@', 2)) LIKE '%.invalid'
   OR lower(split_part(email, '@', 2)) LIKE '%.test'
   OR lower(split_part(email, '@', 2)) LIKE '%.localhost';
