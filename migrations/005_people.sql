-- Canonical family tables used by readFamilyDb / writeFamilyDb.
CREATE TABLE IF NOT EXISTS family_meta (
  id integer PRIMARY KEY,
  title text NOT NULL,
  root_person_id text NOT NULL,
  creator text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS people (
  id text PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  maiden_name text,
  gender text NOT NULL,
  birth_date text,
  death_date text,
  photo_url text,
  phone text,
  notes text,
  parent_ids text[] NOT NULL DEFAULT '{}',
  spouse_ids text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS people_last_name_idx ON people (last_name);

ALTER TABLE family_tree ADD COLUMN IF NOT EXISTS meta jsonb;
ALTER TABLE family_tree ADD COLUMN IF NOT EXISTS people jsonb;
