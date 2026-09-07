import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    loggedIn: session?.role === "admin",
    email: session?.role === "admin" ? session.email : null,
    role: session?.role ?? null,
  });
}
