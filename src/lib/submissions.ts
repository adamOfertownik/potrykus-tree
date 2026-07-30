import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ChangeSubmission } from "@/types/submissions";

const DATA_DIR = path.join(process.cwd(), "data");
const SUBMISSIONS_PATH = path.join(DATA_DIR, "submissions.json");

export async function readSubmissions(): Promise<ChangeSubmission[]> {
  try {
    const raw = await readFile(SUBMISSIONS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { submissions?: ChangeSubmission[] };
    return parsed.submissions ?? [];
  } catch {
    return [];
  }
}

export async function appendSubmission(
  submission: ChangeSubmission,
): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const existing = await readSubmissions();
  existing.push(submission);
  await writeFile(
    SUBMISSIONS_PATH,
    JSON.stringify(
      {
        note: "PROTOTYP — zgłoszenia lokalne, bez trwałej bazy / syncu",
        submissions: existing,
      },
      null,
      2,
    ),
    "utf-8",
  );
}
