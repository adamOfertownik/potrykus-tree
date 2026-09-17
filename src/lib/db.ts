import { readFile, writeFile } from "fs/promises";
import path from "path";
import type {
  FamilyConfig,
  FamilyDatabase,
  FamilyPayload,
  Gender,
  Person,
  PersonPublic,
} from "@/types/family";
import { getSql, hasDb } from "@/lib/sql";
export { getChildrenIds, getPersonMap } from "@/lib/tree";
export { formatPolishDate, displayName, lifespan } from "@/lib/db-client";
import { getChildrenIds } from "@/lib/tree";

const DATA_DIR = path.join(process.cwd(), "data");
const FAMILY_PATH = path.join(DATA_DIR, "family.json");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  maiden_name: string | null;
  gender: string;
  birth_date: string | null;
  death_date: string | null;
  photo_url: string | null;
  phone: string | null;
  notes: string | null;
  parent_ids: string[] | null;
  spouse_ids: string[] | null;
};

type MetaRow = {
  title: string;
  root_person_id: string;
  creator: string | null;
  description: string | null;
  updated_at: string | Date;
};

async function readFamilyFile(): Promise<FamilyDatabase> {
  const raw = await readFile(FAMILY_PATH, "utf-8");
  return JSON.parse(raw) as FamilyDatabase;
}

function isMissingFamilySchema(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /undefined_table|does not exist/i.test(message) &&
    /people|family_meta|family_tree/i.test(message)
  );
}

function asGender(value: string | null | undefined): Gender {
  if (value === "male" || value === "female" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function opt(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}

function asIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    if (text.startsWith("[")) {
      try {
        return asIdList(JSON.parse(text) as unknown);
      } catch {
        /* fall through */
      }
    }
    if (text.startsWith("{") && text.endsWith("}")) {
      return text
        .slice(1, -1)
        .split(",")
        .map((part) => part.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
    }
    return [text];
  }
  return [];
}

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

function rowToPerson(row: PersonRow): Person {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    maidenName: opt(row.maiden_name),
    gender: asGender(row.gender),
    birthDate: opt(row.birth_date),
    deathDate: opt(row.death_date),
    photoUrl: opt(row.photo_url),
    phone: opt(row.phone),
    notes: opt(row.notes),
    parentIds: asIdList(row.parent_ids),
    spouseIds: asIdList(row.spouse_ids),
  };
}

function normalizeStoredPerson(person: Person): Person {
  return {
    ...person,
    parentIds: asIdList(person.parentIds),
    spouseIds: asIdList(person.spouseIds),
    gender: asGender(person.gender),
  };
}

function peopleInsertPayload(people: Person[]): string {
  return JSON.stringify(
    people.map((p) => ({
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
}

async function readFamilyFromNeon(): Promise<FamilyDatabase> {
  const sql = getSql();
  try {
    const metaRows = (await sql`
      SELECT title, root_person_id, creator, description, updated_at
      FROM family_meta
      WHERE id = 1
      LIMIT 1
    `) as MetaRow[];
    const peopleRows = (await sql`
      SELECT
        id, first_name, last_name, maiden_name, gender,
        birth_date, death_date, photo_url, phone, notes,
        parent_ids, spouse_ids
      FROM people
    `) as PersonRow[];

    const meta = metaRows[0];
    if (meta) {
      return {
        meta: {
          title: meta.title,
          rootPersonId: meta.root_person_id,
          creator: meta.creator || "",
          updatedAt: toIso(meta.updated_at),
          description: meta.description || "",
        },
        people: peopleRows.map(rowToPerson),
      };
    }
  } catch (err) {
    if (!isMissingFamilySchema(err)) throw err;
  }

  try {
    const docs = (await sql`
      SELECT meta, people FROM family_tree WHERE id = 'current' LIMIT 1
    `) as { meta: FamilyDatabase["meta"]; people: Person[] }[];
    if (docs[0]?.people?.length) {
      return {
        meta: docs[0].meta,
        people: docs[0].people.map(normalizeStoredPerson),
      };
    }
  } catch {
    /* older schema may only have data jsonb */
  }

  try {
    const docs = (await sql`
      SELECT data FROM family_tree WHERE id = 'current' LIMIT 1
    `) as { data: FamilyDatabase }[];
    if (docs[0]?.data?.people?.length) {
      const data = docs[0].data;
      return {
        ...data,
        people: data.people.map(normalizeStoredPerson),
      };
    }
  } catch {
    /* ignore */
  }

  throw new Error(
    "Brak danych rodziny w Neon (family_meta / people / family_tree).",
  );
}

async function writePeopleTables(
  db: FamilyDatabase,
): Promise<void> {
  const sql = getSql();
  const payload = peopleInsertPayload(db.people);
  await sql.transaction([
    sql`
      INSERT INTO family_meta (id, title, root_person_id, creator, description, updated_at)
      VALUES (
        1,
        ${db.meta.title},
        ${db.meta.rootPersonId},
        ${db.meta.creator},
        ${db.meta.description},
        ${db.meta.updatedAt}::timestamptz
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
}

async function writeFamilyTreeDocument(
  db: FamilyDatabase,
  adminId?: string,
): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO family_tree (id, data, updated_at, updated_by_admin_id)
      VALUES (
        'current',
        ${db as never},
        ${db.meta.updatedAt}::timestamptz,
        ${adminId ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        updated_by_admin_id = EXCLUDED.updated_by_admin_id
    `;
  } catch {
    /* data column may be unused after 005 */
  }
  try {
    await sql`
      INSERT INTO family_tree (id, meta, people, updated_at)
      VALUES (
        'current',
        ${JSON.stringify(db.meta)}::jsonb,
        ${JSON.stringify(db.people)}::jsonb,
        ${db.meta.updatedAt}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        meta = EXCLUDED.meta,
        people = EXCLUDED.people,
        updated_at = EXCLUDED.updated_at
    `;
  } catch {
    /* optional document cache */
  }
}

export async function readFamilyDb(): Promise<FamilyDatabase> {
  if (!hasDb()) return readFamilyFile();
  return readFamilyFromNeon();
}

export async function writeFamilyDb(
  db: FamilyDatabase,
  adminId?: string,
): Promise<void> {
  db.meta.updatedAt = new Date().toISOString();
  if (hasDb()) {
    try {
      await writePeopleTables(db);
      try {
        await writeFamilyTreeDocument(db, adminId);
      } catch {
        // Document cache is optional; people + family_meta are canonical.
      }
      return;
    } catch (err) {
      if (!isMissingFamilySchema(err)) throw err;
    }
  }
  await writeFile(FAMILY_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function toFamilyPayload(db: FamilyDatabase): FamilyPayload {
  const people: PersonPublic[] = db.people.map((p) => ({
    ...p,
    childrenIds: getChildrenIds(db.people, p.id),
  }));
  return {
    meta: db.meta,
    people,
    unlocked: true,
  };
}

/**
 * Env wins in production; data/config.json is the local/dev fallback.
 * Prefer SESSION_SECRET + ACCESS_CODE_HASH so the file can stay out of prod secrets.
 */
export async function readConfig(): Promise<FamilyConfig> {
  const file = JSON.parse(
    await readFile(CONFIG_PATH, "utf-8"),
  ) as FamilyConfig;

  return {
    accessCodeHash:
      process.env.ACCESS_CODE_HASH?.trim() || file.accessCodeHash,
    sessionSecret: process.env.SESSION_SECRET?.trim() || file.sessionSecret,
    cookieName:
      process.env.COOKIE_NAME?.trim() ||
      file.cookieName ||
      "potrykus_family_session",
  };
}
