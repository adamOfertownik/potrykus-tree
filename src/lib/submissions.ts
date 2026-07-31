import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ChangeSubmission } from "@/types/submissions";
import { getSql, hasDb } from "@/lib/sql";

const DATA_DIR = path.join(process.cwd(), "data");
const SUBMISSIONS_PATH = path.join(DATA_DIR, "submissions.json");

async function readFileSubmissions(): Promise<ChangeSubmission[]> {
  try {
    const raw = await readFile(SUBMISSIONS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { submissions?: ChangeSubmission[] };
    return parsed.submissions ?? [];
  } catch {
    return [];
  }
}

async function writeFileSubmissions(
  submissions: ChangeSubmission[],
): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    SUBMISSIONS_PATH,
    JSON.stringify(
      {
        note: "Fallback lokalny — ustaw DATABASE_URL, żeby pisać do Neona",
        submissions,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

type Row = {
  id: string;
  created_at: string | Date;
  kind: string;
  reporter_name: string;
  reporter_person_id: string | null;
  reporter_phone: string | null;
  target_person_id: string | null;
  target_person_name: string | null;
  message: string;
  payload: {
    self?: ChangeSubmission["self"];
    relatives?: ChangeSubmission["relatives"];
    graphEdit?: ChangeSubmission["graphEdit"];
  } | null;
  status: string;
};

function rowToSubmission(row: Row): ChangeSubmission {
  return {
    id: row.id,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : row.created_at.toISOString(),
    kind: row.kind as ChangeSubmission["kind"],
    reporterName: row.reporter_name,
    reporterPersonId: row.reporter_person_id || undefined,
    reporterPhone: row.reporter_phone || undefined,
    targetPersonId: row.target_person_id || undefined,
    targetPersonName: row.target_person_name || undefined,
    message: row.message,
    self: row.payload?.self,
    relatives: row.payload?.relatives,
    graphEdit: row.payload?.graphEdit,
    status: row.status as ChangeSubmission["status"],
  };
}

export async function readSubmissions(): Promise<ChangeSubmission[]> {
  if (!hasDb()) return readFileSubmissions();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, created_at, kind, reporter_name, reporter_person_id,
           reporter_phone, target_person_id, target_person_name,
           message, payload, status
    FROM submissions
    ORDER BY created_at DESC
  `) as Row[];
  return rows.map(rowToSubmission);
}

export async function appendSubmission(
  submission: ChangeSubmission,
): Promise<ChangeSubmission> {
  if (!hasDb()) {
    const existing = await readFileSubmissions();
    const saved = { ...submission, status: "local_only" as const };
    existing.push(saved);
    await writeFileSubmissions(existing);
    return saved;
  }

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO submissions (
      kind, reporter_name, reporter_person_id, reporter_phone,
      target_person_id, target_person_name, message, payload, status
    ) VALUES (
      ${submission.kind},
      ${submission.reporterName},
      ${submission.reporterPersonId ?? null},
      ${submission.reporterPhone ?? null},
      ${submission.targetPersonId ?? null},
      ${submission.targetPersonName ?? null},
      ${submission.message},
      ${{
        self: submission.self ?? null,
        relatives: submission.relatives ?? null,
        graphEdit: submission.graphEdit ?? null,
      }},
      ${"new"}
    )
    RETURNING id, created_at, kind, reporter_name, reporter_person_id,
              reporter_phone, target_person_id, target_person_name,
              message, payload, status
  `) as Row[];

  return rowToSubmission(rows[0]);
}

export async function updateSubmissionStatus(
  id: string,
  status: ChangeSubmission["status"],
): Promise<ChangeSubmission | null> {
  if (!hasDb()) {
    const existing = await readFileSubmissions();
    const idx = existing.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    existing[idx] = { ...existing[idx], status };
    await writeFileSubmissions(existing);
    return existing[idx];
  }

  const sql = getSql();
  const rows = (await sql`
    UPDATE submissions SET status = ${status}
    WHERE id = ${id}::uuid
    RETURNING id, created_at, kind, reporter_name, reporter_person_id,
              reporter_phone, target_person_id, target_person_name,
              message, payload, status
  `) as Row[];
  return rows[0] ? rowToSubmission(rows[0]) : null;
}
