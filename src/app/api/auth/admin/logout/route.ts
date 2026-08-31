import { NextResponse } from "next/server";
import { clearAdminSessionOnResponse } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  await clearAdminSessionOnResponse(response);
  return response;
}
