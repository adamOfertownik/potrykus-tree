import { NextResponse } from "next/server";
import {
  clearSessionOnResponse,
  signOutSupabase,
} from "@/lib/auth";

export async function POST() {
  await signOutSupabase();
  const response = NextResponse.json({ ok: true });
  await clearSessionOnResponse(response);
  return response;
}
