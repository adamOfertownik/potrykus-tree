-- Allow sketch rows: staged edits that were not sent as a real submission.
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('new', 'reviewed', 'accepted', 'rejected', 'local_only', 'sketch'));
