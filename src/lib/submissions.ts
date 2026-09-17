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
    graphEdits?: ChangeSubmission["graphEdits"];
    correction?: ChangeSubmission["correction"];
    photoUrl?: string;
    photoAction?: ChangeSubmission["photoAction"];
    before?: ChangeSubmission["before"];
  } | null;
  status: string;
  reviewed_at?: string | Date | null;
  reviewed_by_admin_id?: string | null;
};

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.toISOString();
}

function payloadFrom(submission: ChangeSubmission) {
  return {
    self: submission.self ?? null,
    relatives: submission.relatives ?? null,
    graphEdit: submission.graphEdit ?? null,
    graphEdits: submission.graphEdits ?? null,
    correction: submission.correction ?? null,
    photoUrl: submission.photoUrl ?? null,
    photoAction: submission.photoAction ?? null,
    before: submission.before ?? null,
  };
}

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
    graphEdits: row.payload?.graphEdits,
    correction: row.payload?.correction,
    photoUrl: row.payload?.photoUrl,
    photoAction: row.payload?.photoAction,
    before: row.payload?.before,
    status: row.status as ChangeSubmission["status"],
    reviewedAt: toIso(row.reviewed_at),
    reviewedByAdminId: row.reviewed_by_admin_id || undefined,
  };
}

export async function readSubmissions(): Promise<ChangeSubmission[]> {
  if (!hasDb()) return readFileSubmissions();
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT id, created_at, kind, reporter_name, reporter_person_id,
             reporter_phone, target_person_id, target_person_name,
             message, payload, status, reviewed_at, reviewed_by_admin_id
      FROM submissions
      ORDER BY created_at DESC
    `) as Row[];
    return rows.map(rowToSubmission);
  } catch {
    const rows = (await sql`
      SELECT id, created_at, kind, reporter_name, reporter_person_id,
             reporter_phone, target_person_id, target_person_name,
             message, payload, status
      FROM submissions
      ORDER BY created_at DESC
    `) as Row[];
    return rows.map(rowToSubmission);
  }
}

export async function getSubmissionById(
  id: string,
): Promise<ChangeSubmission | null> {
  if (!hasDb()) {
    const existing = await readFileSubmissions();
    return existing.find((s) => s.id === id) ?? null;
  }
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT id, created_at, kind, reporter_name, reporter_person_id,
             reporter_phone, target_person_id, target_person_name,
             message, payload, status, reviewed_at, reviewed_by_admin_id
      FROM submissions
      WHERE id = ${id}::uuid
    `) as Row[];
    return rows[0] ? rowToSubmission(rows[0]) : null;
  } catch {
    const rows = (await sql`
      SELECT id, created_at, kind, reporter_name, reporter_person_id,
             reporter_phone, target_person_id, target_person_name,
             message, payload, status
      FROM submissions
      WHERE id = ${id}::uuid
    `) as Row[];
    return rows[0] ? rowToSubmission(rows[0]) : null;
  }
}

export async function appendSubmission(
  submission: ChangeSubmission,
): Promise<ChangeSubmission> {
  if (!hasDb()) {
    const existing = await readFileSubmissions();
    const saved = { ...submission, status: "local_only" as const };
    existing.unshift(saved);
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
      ${payloadFrom(submission)},
      ${"new"}
    )
    RETURNING id, created_at, kind, reporter_name, reporter_person_id,
              reporter_phone, target_person_id, target_person_name,
              message, payload, status
  `) as Row[];

  return rowToSubmission(rows[0]);
}

export async function saveSubmission(
  submission: ChangeSubmission,
): Promise<ChangeSubmission | null> {
  if (!hasDb()) {
    const existing = await readFileSubmissions();
    const idx = existing.findIndex((s) => s.id === submission.id);
    if (idx < 0) return null;
    existing[idx] = submission;
    await writeFileSubmissions(existing);
    return existing[idx];
  }

  const sql = getSql();
  try {
    const rows = (await sql`
      UPDATE submissions
      SET kind = ${submission.kind},
          reporter_name = ${submission.reporterName},
          reporter_person_id = ${submission.reporterPersonId ?? null},
          reporter_phone = ${submission.reporterPhone ?? null},
          target_person_id = ${submission.targetPersonId ?? null},
          target_person_name = ${submission.targetPersonName ?? null},
          message = ${submission.message},
          payload = ${payloadFrom(submission)},
          status = ${submission.status},
          reviewed_at = ${submission.reviewedAt ?? null},
          reviewed_by_admin_id = ${submission.reviewedByAdminId ?? null}
      WHERE id = ${submission.id}::uuid
      RETURNING id, created_at, kind, reporter_name, reporter_person_id,
                reporter_phone, target_person_id, target_person_name,
                message, payload, status, reviewed_at, reviewed_by_admin_id
    `) as Row[];
    return rows[0] ? rowToSubmission(rows[0]) : null;
  } catch {
    const rows = (await sql`
      UPDATE submissions
      SET kind = ${submission.kind},
          message = ${submission.message},
          payload = ${payloadFrom(submission)},
          status = ${submission.status}
      WHERE id = ${submission.id}::uuid
      RETURNING id, created_at, kind, reporter_name, reporter_person_id,
                reporter_phone, target_person_id, target_person_name,
                message, payload, status
    `) as Row[];
    return rows[0] ? rowToSubmission(rows[0]) : null;
  }
}

export async function updateSubmissionStatus(
  id: string,
  status: ChangeSubmission["status"],
  reviewedByAdminId?: string,
): Promise<ChangeSubmission | null> {
  const reviewedAt = new Date().toISOString();
  if (!hasDb()) {
    const existing = await readFileSubmissions();
    const idx = existing.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    existing[idx] = {
      ...existing[idx],
      status,
      reviewedAt,
      reviewedByAdminId,
    };
    await writeFileSubmissions(existing);
    return existing[idx];
  }

  const sql = getSql();
  try {
    const rows = (await sql`
      UPDATE submissions
      SET status = ${status},
          reviewed_at = ${reviewedAt}::timestamptz,
          reviewed_by_admin_id = ${reviewedByAdminId ?? null}
      WHERE id = ${id}::uuid
      RETURNING id, created_at, kind, reporter_name, reporter_person_id,
                reporter_phone, target_person_id, target_person_name,
                message, payload, status, reviewed_at, reviewed_by_admin_id
    `) as Row[];
    return rows[0] ? rowToSubmission(rows[0]) : null;
  } catch {
    const rows = (await sql`
      UPDATE submissions SET status = ${status}
      WHERE id = ${id}::uuid
      RETURNING id, created_at, kind, reporter_name, reporter_person_id,
                reporter_phone, target_person_id, target_person_name,
                message, payload, status
    `) as Row[];
    const updated = rows[0] ? rowToSubmission(rows[0]) : null;
    if (updated) {
      updated.reviewedAt = reviewedAt;
      updated.reviewedByAdminId = reviewedByAdminId;
    }
    return updated;
  }
}
