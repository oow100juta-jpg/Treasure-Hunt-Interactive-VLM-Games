import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/game/session";
import { getGamePhase } from "@/lib/game/phase";
import { apiError, assertSameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { supabase, team, room } = await requireParticipant();
    const phase = getGamePhase({ status: room.status, startedAt: room.started_at, leaderboardFreezesAt: room.leaderboard_freezes_at, endsAt: room.ends_at, endedAt: room.ended_at });
    if (phase !== "active_leaderboard_frozen") return NextResponse.json({ error: "The leaderboard has not frozen." }, { status: 409 });
    if (!team.leaderboard_freeze_acknowledged_at) {
      let nextStatus = team.status === "freeze_notice" ? "searching" : team.status;
      if (team.status === "viewing_leaderboard") {
        const { data: next } = await supabase.from("clue_assignments").select("id").eq("team_id", team.id).eq("status", "assigned").eq("is_revealed", false).order("sequence_number").limit(1).maybeSingle();
        if (next) {
          await supabase.from("clue_assignments").update({ status: "active", is_revealed: true, first_viewed_at: new Date().toISOString() }).eq("id", next.id).eq("is_revealed", false);
          nextStatus = "searching";
        } else nextStatus = "completed_all";
      }
      await supabase.from("teams").update({ leaderboard_freeze_acknowledged_at: new Date().toISOString(), status: nextStatus }).eq("id", team.id);
      await supabase.from("participant_events").insert({ room_id: room.id, team_id: team.id, event_type: "freeze_acknowledged", metadata: {} });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
