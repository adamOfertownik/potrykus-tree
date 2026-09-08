import { NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/auth";
import { readFamilyDb, replaceFamilyFromFile } from "@/lib/db";
import { hasDb, storageMode } from "@/lib/sql";

export async function GET() {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }

  try {
    const db = await readFamilyDb();
    return NextResponse.json({
      storage: storageMode(),
      peopleCount: db.people.length,
      rootPersonId: db.meta.rootPersonId,
      updatedAt: db.meta.updatedAt,
      title: db.meta.title,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Błąd odczytu drzewa." },
      { status: 500 },
    );
  }
}

export async function POST() {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  if (!hasDb()) {
    return NextResponse.json(
      {
        error:
          "Brak DATABASE_URL. Ustaw Neon, uruchom npm run db:migrate, potem wgraj bazę.",
      },
      { status: 400 },
    );
  }

  try {
    const db = await replaceFamilyFromFile();
    return NextResponse.json({
      ok: true,
      storage: storageMode(),
      peopleCount: db.people.length,
      rootPersonId: db.meta.rootPersonId,
      updatedAt: db.meta.updatedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Nie udało się wgrać drzewa." },
      { status: 500 },
    );
  }
}
