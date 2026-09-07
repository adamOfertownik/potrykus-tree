import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { inspectFamilyStorage } from "@/lib/db";
import { applySchemaMigrations } from "@/lib/bootstrap";
import { getAccessLinksStatus } from "@/lib/invite";
import { listUsers } from "@/lib/users";
import { hasDb, storageMode } from "@/lib/sql";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }

  if (hasDb()) {
    try {
      await applySchemaMigrations();
    } catch {
      /* status still useful without a fresh migrate */
    }
  }

  const tree = await inspectFamilyStorage();
  const links = await getAccessLinksStatus();
  let users = { admin: 0, member: 0 };
  try {
    const all = await listUsers();
    users = {
      admin: all.filter((u) => u.role === "admin").length,
      member: all.filter((u) => u.role === "member").length,
    };
  } catch {
    /* tables may still be migrating */
  }

  return NextResponse.json({
    storage: storageMode(),
    tree,
    users,
    links,
  });
}
