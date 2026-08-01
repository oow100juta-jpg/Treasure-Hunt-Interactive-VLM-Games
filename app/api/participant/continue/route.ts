import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/game/session";
import { getGamePhase } from "@/lib/game/phase";
import { apiError, assertSameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { supabase, team, room } = await requireParticipant();
    const phase = getGamePhase({ status: room.status, startedAt: room.started_at, leaderboardFreezesAt: room.leaderboard_freezes_at, endsAt: room.ends_at, endedAt: room.ended_at });
    if (phase === "ended") return NextResponse.json({ error: "The game has ended." }, { status: 409 });
    const body = await request.json().catch(() => ({})) as { mode?: string };
    if (body.mode === "leaderboard") {
      if (phase !== "active_leaderboard_visible") return NextResponse.json({ error: "The leaderboard is no longer visible." }, { status: 409 });
      await supabase.from("teams").update({ status: "viewing_leaderboard", last_seen_at: new Date().toISOString() }).eq("id", team.id);
      return NextResponse.json({ ok: true });
    }
    const { data: next } = await supabase.from("clue_assignments").select("id,status,is_revealed").eq("team_id", team.id).eq("status", "assigned").order("sequence_number").limit(1).maybeSingle();
    if (next && !next.is_revealed) await supabase.from("clue_assignments").update({ is_revealed: true, status: "active", first_viewed_at: new Date().toISOString() }).eq("id", next.id).eq("is_revealed", false);
    await supabase.from("teams").update({ status: next ? "searching" : "completed_all", last_seen_at: new Date().toISOString() }).eq("id", team.id);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
