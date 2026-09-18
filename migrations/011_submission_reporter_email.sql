-- Optional address used only to send a confirmation copy of the submission.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS reporter_email text;
