#!/usr/bin/env node
/**
 * Upload data/family.json into Neon (family_meta + people).
 * Usage: npm run db:seed-family
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { loadEnvFiles, root } from "./load-env.mjs";

loadEnvFiles();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is missing. Set it in .env.local and retry.");
  process.exit(1);
}

const familyPath = join(root, "data", "family.json");
const family = JSON.parse(readFileSync(familyPath, "utf8"));
if (!Array.isArray(family.people) || family.people.length === 0) {
  console.error("data/family.json has no people.");
  process.exit(1);
}

const payload = JSON.stringify(
  family.people.map((p) => ({
    id: p.id,
    first_name: p.firstName,
    last_name: p.lastName,
    maiden_name: p.maidenName ?? null,
    gender: p.gender,
    birth_date: p.birthDate ?? null,
    death_date: p.deathDate ?? null,
    photo_url: p.photoUrl ?? null,
    phone: p.phone ?? null,
    notes: p.notes ?? null,
    parent_ids: p.parentIds ?? [],
    spouse_ids: p.spouseIds ?? [],
  })),
);

const sql = neon(url);
const updatedAt = new Date().toISOString();

await sql.transaction([
  sql`
    INSERT INTO family_meta (id, title, root_person_id, creator, description, updated_at)
    VALUES (
      1,
      ${family.meta.title},
      ${family.meta.rootPersonId},
      ${family.meta.creator},
      ${family.meta.description},
      ${updatedAt}::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      root_person_id = EXCLUDED.root_person_id,
      creator = EXCLUDED.creator,
      description = EXCLUDED.description,
      updated_at = EXCLUDED.updated_at
  `,
  sql`DELETE FROM people`,
  sql`
    INSERT INTO people (
      id, first_name, last_name, maiden_name, gender,
      birth_date, death_date, photo_url, phone, notes,
      parent_ids, spouse_ids
    )
    SELECT
      id, first_name, last_name, maiden_name, gender,
      birth_date, death_date, photo_url, phone, notes,
      parent_ids, spouse_ids
    FROM jsonb_to_recordset(${payload}::jsonb) AS t(
      id text,
      first_name text,
      last_name text,
      maiden_name text,
      gender text,
      birth_date text,
      death_date text,
      photo_url text,
      phone text,
      notes text,
      parent_ids text[],
      spouse_ids text[]
    )
  `,
]);

const [{ count }] = await sql`SELECT count(*)::int AS count FROM people`;
const [meta] = await sql`
  SELECT title, root_person_id, updated_at FROM family_meta WHERE id = 1
`;

try {
  const treeMeta = { ...family.meta, updatedAt };
  await sql`
    INSERT INTO family_tree (id, meta, people, updated_at)
    VALUES (
      'current',
      ${JSON.stringify(treeMeta)}::jsonb,
      ${JSON.stringify(family.people)}::jsonb,
      ${updatedAt}::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      meta = EXCLUDED.meta,
      people = EXCLUDED.people,
      updated_at = EXCLUDED.updated_at
  `;
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn("family_tree document not synced:", message);
}

console.log(`Seeded ${count} people into Neon`);
console.log(`Root: ${meta.root_person_id}`);
console.log(`Title: ${meta.title}`);
