import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/game/session";
import { apiError, assertSameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try { assertSameOrigin(request); const { supabase, team } = await requireParticipant(); await supabase.from("teams").update({ last_seen_at: new Date().toISOString() }).eq("id", team.id); return NextResponse.json({ ok: true }); }
  catch (error) { return apiError(error); }
}
