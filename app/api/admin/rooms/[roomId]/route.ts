import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { rankTeams } from "@/lib/game/leaderboard";
import { getGamePhase } from "@/lib/game/phase";
import { apiError } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await context.params;
    const { supabase, user } = await requireAdmin();
    await supabase.rpc("expire_room_if_needed", { target_room_id: roomId });
    const { data: room, error: roomError } = await supabase.from("game_rooms").select("*").eq("id", roomId).eq("created_by", user.id).single();
    if (roomError || !room) throw roomError ?? new Error("Room not found");
    const storageAdmin = createAdminClient();
    const { data: teamRows } = await supabase.from("teams")
      .select("id,name,status,total_score,completed_clue_count,total_attempt_count,leaderboard_freeze_acknowledged_at,last_seen_at")
      .eq("room_id", roomId);
    const { data: assignmentRows } = await supabase.from("clue_assignments")
      .select("team_id,clues(text,difficulty)")
      .eq("room_id", roomId)
      .in("status", ["assigned","active","reviewing","rejected"]);
    const { data: submissionRows } = await supabase.from("submissions")
      .select("id,team_id,image_path,evaluation_status,final_decision,ai_decision,decision_source,detected_object,evaluation_reason,confidence,attempt_number,submitted_at,teams(name),clue_assignments(clues(text))")
      .eq("room_id", roomId)
      .order("submitted_at", { ascending: false })
      .limit(30);
    const teams = await Promise.all((teamRows ?? []).map(async (team) => {
      const completed = await supabase.from("clue_assignments").select("completed_at,attempt_count").eq("team_id", team.id).eq("status", "completed");
      const active = (assignmentRows ?? []).find((row) => row.team_id === team.id) as unknown as { clues?: { text: string; difficulty: string } } | undefined;
      const latest = (submissionRows ?? []).find((row) => row.team_id === team.id);
      const items = completed.data ?? [];
      return { ...team, currentClue: active?.clues?.text ?? null, clueDifficulty: active?.clues?.difficulty ?? null, online: Date.now() - new Date(team.last_seen_at).getTime() < 45_000, latestDecision: latest?.final_decision ?? null, latestReason: latest?.evaluation_reason ?? null, acceptedFirstTryCount: items.filter((item) => item.attempt_count === 1).length, latestCompletionAt: items.map((item) => item.completed_at).filter(Boolean).sort().at(-1) ?? null };
    }));
    const leaderboard = rankTeams(teams.map((team) => ({ id: team.id, name: team.name, totalScore: team.total_score, completedClueCount: team.completed_clue_count, totalAttemptCount: team.total_attempt_count, acceptedFirstTryCount: team.acceptedFirstTryCount, latestCompletionAt: team.latestCompletionAt, status: team.status })));
    const submissions = await Promise.all((submissionRows ?? []).map(async (submission) => {
      const { data, error } = await storageAdmin.storage.from("participant-submissions").createSignedUrl(submission.image_path, 300);
      if (error) console.error(`[admin submission image] Could not sign ${submission.id}:`, error.message);
      return {
        id: submission.id,
        team_id: submission.team_id,
        evaluation_status: submission.evaluation_status,
        final_decision: submission.final_decision,
        ai_decision: submission.ai_decision,
        decision_source: submission.decision_source,
        detected_object: submission.detected_object,
        evaluation_reason: submission.evaluation_reason,
        confidence: submission.confidence,
        attempt_number: submission.attempt_number,
        submitted_at: submission.submitted_at,
        teams: submission.teams,
        clue_assignments: submission.clue_assignments,
        imageUrl: data?.signedUrl ?? null,
      };
    }));
    const phase = getGamePhase({ status: room.status, startedAt: room.started_at, leaderboardFreezesAt: room.leaderboard_freezes_at, endsAt: room.ends_at, endedAt: room.ended_at });
    return NextResponse.json({ room, phase, teams, leaderboard, submissions });
  } catch (error) { return apiError(error); }
}
