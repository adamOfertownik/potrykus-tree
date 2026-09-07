-- Zdjęcia ze spotkania rodzinnego (przechowywane w Vercel Blob, metadane w Neon)
CREATE TABLE IF NOT EXISTS event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  url text NOT NULL,
  uploader_name text NOT NULL,
  uploader_person_id text,
  caption text,
  status text NOT NULL DEFAULT 'visible',
  CONSTRAINT event_photos_status_check
    CHECK (status IN ('visible', 'hidden', 'local_only'))
);

CREATE INDEX IF NOT EXISTS event_photos_created_at_idx ON event_photos (created_at DESC);
CREATE INDEX IF NOT EXISTS event_photos_status_idx ON event_photos (status);
