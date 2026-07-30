import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";

export async function GET() {
  const unlocked = await isSessionValid();
  return NextResponse.json({ unlocked });
}
