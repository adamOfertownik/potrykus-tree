import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { EventPhoto } from "@/types/event";
import { getSql, hasDb } from "@/lib/sql";

const DATA_DIR = path.join(process.cwd(), "data");
const PHOTOS_PATH = path.join(DATA_DIR, "event-photos.json");

async function readFilePhotos(): Promise<EventPhoto[]> {
  try {
    const raw = await readFile(PHOTOS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { photos?: EventPhoto[] };
    return parsed.photos ?? [];
  } catch {
    return [];
  }
}

async function writeFilePhotos(photos: EventPhoto[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    PHOTOS_PATH,
    JSON.stringify(
      {
        note: "Fallback lokalny — ustaw DATABASE_URL, żeby pisać do Neona",
        photos,
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
  url: string;
  uploader_name: string;
  uploader_person_id: string | null;
  caption: string | null;
  status: string;
};

function rowToPhoto(row: Row): EventPhoto {
  return {
    id: row.id,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : row.created_at.toISOString(),
    url: row.url,
    uploaderName: row.uploader_name,
    uploaderPersonId: row.uploader_person_id || undefined,
    caption: row.caption || undefined,
    status: row.status as EventPhoto["status"],
  };
}

export async function readPhotos(): Promise<EventPhoto[]> {
  if (!hasDb()) return readFilePhotos();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, created_at, url, uploader_name, uploader_person_id, caption, status
    FROM event_photos
    WHERE status <> 'hidden'
    ORDER BY created_at DESC
  `) as Row[];
  return rows.map(rowToPhoto);
}

export async function appendPhoto(
  photo: Omit<EventPhoto, "id" | "createdAt" | "status">,
): Promise<EventPhoto> {
  if (!hasDb()) {
    const existing = await readFilePhotos();
    const saved: EventPhoto = {
      ...photo,
      id: `photo-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: "local_only",
    };
    existing.unshift(saved);
    await writeFilePhotos(existing);
    return saved;
  }

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO event_photos (url, uploader_name, uploader_person_id, caption, status)
    VALUES (
      ${photo.url},
      ${photo.uploaderName},
      ${photo.uploaderPersonId ?? null},
      ${photo.caption ?? null},
      ${"visible"}
    )
    RETURNING id, created_at, url, uploader_name, uploader_person_id, caption, status
  `) as Row[];
  return rowToPhoto(rows[0]);
}
