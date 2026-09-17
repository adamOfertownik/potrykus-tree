ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;
