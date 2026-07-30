import { NextResponse } from "next/server";
import { clearSessionOnResponse } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  await clearSessionOnResponse(response);
  return response;
}
