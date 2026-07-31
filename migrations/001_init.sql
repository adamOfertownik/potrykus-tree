-- Drzewo Potrykus — initial write-side tables
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
