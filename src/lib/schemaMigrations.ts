/** Idempotent schema for Neon. Applied from /api/setup so Vercel CLI is not required. */
export const SCHEMA_MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  reporter_name text NOT NULL,
  reporter_person_id text,
  reporter_phone text,
  target_person_id text,
  target_person_name text,
  message text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',
  CONSTRAINT submissions_status_check
    CHECK (status IN ('new', 'reviewed', 'accepted', 'rejected', 'local_only'))
);

CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  person_id text,
  phone text,
  guests int NOT NULL CHECK (guests >= 1 AND guests <= 20),
  notes text,
  will_transfer boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new',
  CONSTRAINT event_rsvps_status_check
    CHECK (status IN ('new', 'confirmed', 'cancelled', 'local_only'))
);

CREATE INDEX IF NOT EXISTS event_rsvps_created_at_idx ON event_rsvps (created_at DESC);
CREATE INDEX IF NOT EXISTS event_rsvps_status_idx ON event_rsvps (status);
`,
  },
  {
    id: "002_event_rsvp_breakdown",
    sql: `
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS adults int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS children_3_12 int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_under_3 int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_pln int NOT NULL DEFAULT 0;

ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_adults_check;
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_adults_check
  CHECK (adults >= 0 AND adults <= 20);

ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_children_3_12_check;
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_children_3_12_check
  CHECK (children_3_12 >= 0 AND children_3_12 <= 20);

ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_children_under_3_check;
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_children_under_3_check
  CHECK (children_under_3 >= 0 AND children_under_3 <= 20);
`,
  },
  {
    id: "003_admin_users",
    sql: `
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT admin_users_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (email);
`,
  },
  {
    id: "004_app_users",
    sql: `
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
`,
  },
  {
    id: "005_invite_key",
    sql: `
CREATE TABLE IF NOT EXISTS app_settings (
  id text PRIMARY KEY,
  invite_code_hash text,
  invite_updated_at timestamptz,
  CONSTRAINT app_settings_singleton CHECK (id = 'default')
);

INSERT INTO app_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;
`,
  },
  {
    id: "006_family_graph",
    sql: `
CREATE TABLE IF NOT EXISTS family_graph (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_graph_singleton CHECK (id = 'default')
);
`,
  },
  {
    id: "007_access_links",
    sql: `
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
`,
  },
];
