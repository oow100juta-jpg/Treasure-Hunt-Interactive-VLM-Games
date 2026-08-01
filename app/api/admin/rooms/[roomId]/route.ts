import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { rankTeams } from "@/lib/game/leaderboard";
import { getGamePhase } from "@/lib/game/phase";
import { deleteRoomSchema } from "@/lib/game/validation";
import { apiError, assertSameOrigin } from "@/lib/http";

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
    return NextResponse.json({ serverNow: new Date().toISOString(), room, phase, teams, leaderboard, submissions });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    assertSameOrigin(request);
    const { roomId } = await context.params;
    const { supabase, user } = await requireAdmin();
    const parsed = deleteRoomSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const { data: room, error: roomError } = await supabase.from("game_rooms")
      .select("id,code")
      .eq("id", roomId)
      .eq("created_by", user.id)
      .single();
    if (roomError || !room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
    if (parsed.data.confirmation !== room.code) {
      return NextResponse.json({ error: `Type ${room.code} exactly to delete this room.` }, { status: 400 });
    }

    const admin = createAdminClient();
    const deletionTime = new Date().toISOString();
    const { error: stopError } = await admin.from("game_rooms").update({
      status: "ended",
      registration_open: false,
      ended_at: deletionTime,
      ends_at: deletionTime,
    }).eq("id", room.id).eq("created_by", user.id);
    if (stopError) throw stopError;

    const { data: submissions, error: submissionError } = await admin.from("submissions").select("image_path").eq("room_id", room.id);
    if (submissionError) throw submissionError;
    const { data: roomClues, error: roomClueError } = await admin.from("room_clues").select("clue_id").eq("room_id", room.id);
    if (roomClueError) throw roomClueError;
    const storedPaths = await listRoomStoragePaths(admin, room.id);
    const imagePaths = [...new Set([...(submissions ?? []).map((submission) => submission.image_path), ...storedPaths])];
    for (let index = 0; index < imagePaths.length; index += 100) {
      const { error: storageError } = await admin.storage.from("participant-submissions").remove(imagePaths.slice(index, index + 100));
      if (storageError) throw storageError;
    }

    const { data: deletedRoom, error: deleteError } = await admin.from("game_rooms")
      .delete()
      .eq("id", room.id)
      .eq("created_by", user.id)
      .select("id")
      .single();
    if (deleteError || !deletedRoom) throw deleteError ?? new Error("Room deletion did not complete.");
    const removedCustomClues = await removeOrphanedCustomClues(admin, user.id, (roomClues ?? []).map((item) => item.clue_id));
    return NextResponse.json({ deleted: true, removedImages: imagePaths.length, removedCustomClues });
  } catch (error) {
    return apiError(error);
  }
}

async function listRoomStoragePaths(admin: ReturnType<typeof createAdminClient>, roomId: string) {
  const files: string[] = [];
  const folders = [roomId];
  while (folders.length) {
    const folder = folders.shift();
    if (!folder) continue;
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from("participant-submissions").list(folder, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = `${folder}/${item.name}`;
        if (item.id) files.push(path);
        else folders.push(path);
      }
      if (!data || data.length < 100) break;
      offset += data.length;
    }
  }
  return files;
}

async function removeOrphanedCustomClues(admin: ReturnType<typeof createAdminClient>, userId: string, candidateIds: string[]) {
  const clueIds = [...new Set(candidateIds)];
  if (!clueIds.length) return 0;
  const [{ data: customClues, error: clueError }, { data: memberships, error: membershipError }, { data: assignments, error: assignmentError }] = await Promise.all([
    admin.from("clues").select("id").eq("created_by", userId).in("id", clueIds),
    admin.from("room_clues").select("clue_id").in("clue_id", clueIds),
    admin.from("clue_assignments").select("clue_id").in("clue_id", clueIds),
  ]);
  if (clueError) throw clueError;
  if (membershipError) throw membershipError;
  if (assignmentError) throw assignmentError;
  const retained = new Set([...(memberships ?? []).map((item) => item.clue_id), ...(assignments ?? []).map((item) => item.clue_id)]);
  const orphanedIds = (customClues ?? []).map((clue) => clue.id).filter((id) => !retained.has(id));
  if (!orphanedIds.length) return 0;
  const { error: deleteError } = await admin.from("clues").delete().eq("created_by", userId).in("id", orphanedIds);
  if (deleteError) throw deleteError;
  return orphanedIds.length;
}
