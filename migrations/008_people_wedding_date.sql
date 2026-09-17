ALTER TABLE people ADD COLUMN IF NOT EXISTS wedding_date text;

UPDATE people
SET wedding_date = substring(notes from 'ślub\s+(\d{4}-\d{2}-\d{2})')
WHERE wedding_date IS NULL
  AND notes ~ 'ślub\s+\d{4}-\d{2}-\d{2}';

UPDATE people
SET wedding_date = substring(notes from 'ślub\s+(\d{4}-\d{2})')
WHERE wedding_date IS NULL
  AND notes ~ 'ślub\s+\d{4}-\d{2}'
  AND notes !~ 'ślub\s+\d{4}-\d{2}-\d{2}';

UPDATE people
SET wedding_date = substring(notes from 'ślub\s+(\d{4})')
WHERE wedding_date IS NULL
  AND notes ~ 'ślub\s+\d{4}';
