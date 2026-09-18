ALTER TABLE people ADD COLUMN IF NOT EXISTS marriages jsonb;

UPDATE people
SET marriages = CASE
  WHEN spouse_ids IS NULL OR cardinality(spouse_ids) = 0 THEN '[]'::jsonb
  ELSE (
    SELECT jsonb_agg(
      jsonb_build_object(
        'spouseId', sid,
        'weddingDate', CASE WHEN ord = 1 THEN wedding_date END
      )
    )
    FROM unnest(spouse_ids) WITH ORDINALITY AS u(sid, ord)
  )
END
WHERE marriages IS NULL;
