-- RSVP guest breakdown + amount for Spotkanie
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS adults int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS children_3_12 int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_under_3 int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_pln int NOT NULL DEFAULT 0;

ALTER TABLE event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_adults_check;
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_adults_check
  CHECK (adults >= 0 AND adults <= 20);

ALTER TABLE event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_children_3_12_check;
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_children_3_12_check
  CHECK (children_3_12 >= 0 AND children_3_12 <= 20);

ALTER TABLE event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_children_under_3_check;
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_children_under_3_check
  CHECK (children_under_3 >= 0 AND children_under_3 <= 20);
