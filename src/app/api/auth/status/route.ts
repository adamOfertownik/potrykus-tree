import { NextResponse } from "next/server";
import {
  isSessionValid,
  isSupabaseConfigured,
  isSupabaseSessionValid,
} from "@/lib/auth";
import { storageMode } from "@/lib/sql";

export async function GET() {
  const unlocked = await isSessionValid();
  const supabase = isSupabaseConfigured();
  const supabaseUser = supabase ? await isSupabaseSessionValid() : false;

  return NextResponse.json({
    unlocked,
    storage: storageMode(),
    auth: {
      supabaseConfigured: supabase,
      method: supabaseUser ? "supabase" : unlocked ? "code" : null,
    },
  });
}
