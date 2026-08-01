import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { roomSchema } from "@/lib/game/validation";
import { apiError, assertSameOrigin } from "@/lib/http";

export async function GET() {
  try {
    const { supabase, user } = await requireAdmin();
    const { data, error } = await supabase.from("game_rooms")
      .select("id,name,code,status,maximum_teams,game_duration_seconds,leaderboard_visible_seconds,created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ rooms: data });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { supabase, user } = await requireAdmin();
    const parsed = roomSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const value = parsed.data;
    const { data, error } = await supabase.from("game_rooms").insert({
      name: value.name, code: value.code, maximum_teams: value.maximumTeams,
      game_duration_seconds: Math.round(value.gameDurationMinutes * 60),
      leaderboard_visible_seconds: Math.round(value.leaderboardVisibleMinutes * 60),
      clue_progression_strategy: value.clueProgressionStrategy,
      ending_title: value.endingTitle, ending_message: value.endingMessage,
      meeting_location: value.meetingLocation, final_leaderboard_visible: value.finalLeaderboardVisible,
      created_by: user.id,
    }).select("*").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That room code is already in use." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ room: data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
