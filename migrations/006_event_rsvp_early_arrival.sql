-- Optional early-arrival surcharge for the family gathering
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS early_arrival boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_arrival_over_7 int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_arrival_under_7 int NOT NULL DEFAULT 0;

ALTER TABLE event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_early_over_7_check;
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_early_over_7_check
  CHECK (early_arrival_over_7 >= 0 AND early_arrival_over_7 <= 20);

ALTER TABLE event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_early_under_7_check;
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_early_under_7_check
  CHECK (early_arrival_under_7 >= 0 AND early_arrival_under_7 <= 20);
