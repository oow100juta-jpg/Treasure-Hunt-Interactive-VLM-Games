import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/game/session";
import { getGamePhase, isParticipantLeaderboardVisible } from "@/lib/game/phase";
import { rankTeams } from "@/lib/game/leaderboard";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const roomCode = new URL(request.url).searchParams.get("roomCode") ?? undefined;
    const { supabase, team, room } = await requireParticipant(roomCode);
    const now = new Date();
    const phase = getGamePhase({ status: room.status, startedAt: room.started_at, leaderboardFreezesAt: room.leaderboard_freezes_at, endsAt: room.ends_at, endedAt: room.ended_at }, now);
    if (phase === "ended" && room.status === "active") await supabase.rpc("expire_room_if_needed", { target_room_id: room.id });
    await supabase.from("teams").update({ last_seen_at: now.toISOString(), ...(phase === "ended" ? { status: "ended", ended_at: now.toISOString() } : {}) }).eq("id", team.id);

    const { data: assignmentData } = await supabase.from("clue_assignments")
      .select("*, clues(id,text,difficulty,category)")
      .eq("team_id", team.id).in("status", ["assigned", "active", "reviewing", "rejected"]).order("sequence_number", { ascending: false }).limit(1).maybeSingle();
    const assignment = assignmentData as unknown as (Record<string, unknown> & { id: string; status: string; is_revealed: boolean; attempt_count: number; sequence_number: number; clues: { id: string; text: string; difficulty: string; category: string } }) | null;
    const { data: submissionData } = await supabase.from("submissions").select("*").eq("team_id", team.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    let submissionClueText: string | null = null;
    if (submissionData?.assignment_id) {
      const { data: submittedAssignmentData } = await supabase.from("clue_assignments").select("clues(text)").eq("id", submissionData.assignment_id).maybeSingle();
      const submittedAssignment = submittedAssignmentData as unknown as { clues?: { text?: string } } | null;
      submissionClueText = submittedAssignment?.clues?.text ?? null;
    }
    let imageUrl: string | null = null;
    if (submissionData?.image_path) {
      const { data } = await supabase.storage.from("participant-submissions").createSignedUrl(submissionData.image_path, 300);
      imageUrl = data?.signedUrl ?? null;
    }

    let leaderboard: ReturnType<typeof rankTeams> | null = null;
    if (isParticipantLeaderboardVisible(phase, room.final_leaderboard_visible)) {
      const { data: rows } = await supabase.from("teams").select("id,name,total_score,completed_clue_count,total_attempt_count,status").eq("room_id", room.id);
      leaderboard = rankTeams((rows ?? []).map((row) => ({ id: row.id, name: row.name, totalScore: row.total_score, completedClueCount: row.completed_clue_count, totalAttemptCount: row.total_attempt_count, acceptedFirstTryCount: 0, latestCompletionAt: null, status: row.status })));
    }

    const safeAssignment = assignment?.is_revealed ? { id: assignment.id, status: assignment.status, attemptCount: assignment.attempt_count, sequenceNumber: assignment.sequence_number, clue: assignment.clues } : null;
    return NextResponse.json({
      serverNow: now.toISOString(), phase,
      room: { id: room.id, code: room.code, name: room.name, status: room.status, startedAt: room.started_at, endsAt: room.ends_at, leaderboardFreezesAt: room.leaderboard_freezes_at, endingTitle: room.ending_title, endingMessage: room.ending_message, meetingLocation: room.meeting_location, finalLeaderboardVisible: room.final_leaderboard_visible },
      team: { id: team.id, name: team.name, status: phase === "ended" ? "ended" : team.status, totalScore: team.total_score, completedClueCount: team.completed_clue_count, totalAttemptCount: team.total_attempt_count, freezeAcknowledged: Boolean(team.leaderboard_freeze_acknowledged_at) },
      joinedTeamCount: await teamCount(supabase, room.id), assignment: safeAssignment,
      submission: submissionData ? { id: submissionData.id, evaluationStatus: submissionData.evaluation_status, decision: submissionData.final_decision, detectedObject: submissionData.detected_object, reason: submissionData.evaluation_reason, confidence: submissionData.confidence, attemptNumber: submissionData.attempt_number, clueText: submissionClueText, imageUrl } : null,
      leaderboard,
    });
  } catch (error) { return apiError(error); }
}

async function teamCount(supabase: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>, roomId: string) {
  const { count } = await supabase.from("teams").select("id", { count: "exact", head: true }).eq("room_id", roomId);
  return count ?? 0;
}
