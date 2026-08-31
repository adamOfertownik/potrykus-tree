import { NextResponse } from "next/server";
import { getAuthContext, isSupabaseConfigured } from "@/lib/auth";
import { storageMode } from "@/lib/sql";

export async function GET() {
  const ctx = await getAuthContext();

  return NextResponse.json({
    unlocked: ctx.unlocked,
    storage: storageMode(),
    auth: {
      supabaseConfigured: isSupabaseConfigured(),
      method: ctx.method,
      role: ctx.role,
      canEdit: ctx.canEdit,
      email: ctx.email,
    },
  });
}
