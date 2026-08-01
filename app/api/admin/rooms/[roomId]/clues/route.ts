import { NextResponse } from "next/server";
import { addRoomClueSchema, removeRoomClueSchema } from "@/lib/game/validation";
import { apiError, assertSameOrigin } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const { supabase, user } = await requireAdmin();
    await requireOwnedRoom(supabase, roomId, user.id);

    const [{ data: membershipRows, error: membershipError }, { data: clueRows, error: clueError }] = await Promise.all([
      supabase.from("room_clues").select("clue_id").eq("room_id", roomId),
      supabase.from("clues").select("id,text,difficulty,category,expected_objects,weight,order_group,created_at").eq("is_active", true).order("created_at"),
    ]);
    if (membershipError) throw membershipError;
    if (clueError) throw clueError;

    const selectedIds = new Set((membershipRows ?? []).map((row) => row.clue_id));
    const clues = clueRows ?? [];
    return NextResponse.json({
      selected: clues.filter((clue) => selectedIds.has(clue.id)),
      available: clues.filter((clue) => !selectedIds.has(clue.id)),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { roomId } = await context.params;
    const { supabase, user } = await requireAdmin();
    const room = await requireOwnedRoom(supabase, roomId, user.id);
    const parsed = addRoomClueSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    let clueId: string;
    let createdClueId: string | null = null;
    if (parsed.data.mode === "existing") {
      const { data: clue, error } = await supabase.from("clues").select("id").eq("id", parsed.data.clueId).eq("is_active", true).single();
      if (error || !clue) return NextResponse.json({ error: "That clue is not available." }, { status: 404 });
      clueId = clue.id;
    } else {
      const { data: clue, error } = await supabase.from("clues").insert({
        text: parsed.data.text,
        difficulty: parsed.data.difficulty,
        category: parsed.data.category,
        expected_objects: parsed.data.expectedObjects,
        created_by: user.id,
      }).select("id").single();
      if (error) {
        if (error.code === "23505") return NextResponse.json({ error: "A clue with that text already exists. Add it from the existing-clue list instead." }, { status: 409 });
        throw error;
      }
      clueId = clue.id;
      createdClueId = clue.id;
    }

    const { error: membershipError } = await supabase.from("room_clues").insert({ room_id: roomId, clue_id: clueId });
    if (membershipError) {
      if (createdClueId) await supabase.from("clues").delete().eq("id", createdClueId);
      if (membershipError.code === "23505") return NextResponse.json({ error: "That clue is already in this room." }, { status: 409 });
      throw membershipError;
    }
    await resumeCompletedTeams(room);
    return NextResponse.json({ clueId }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { roomId } = await context.params;
    const { supabase, user } = await requireAdmin();
    await requireOwnedRoom(supabase, roomId, user.id);
    const parsed = removeRoomClueSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const { data, error } = await supabase.from("room_clues")
      .delete()
      .eq("room_id", roomId)
      .eq("clue_id", parsed.data.clueId)
      .select("clue_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "That clue is not in this room." }, { status: 404 });
    return NextResponse.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}

async function requireOwnedRoom(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  roomId: string,
  userId: string,
) {
  const { data, error } = await supabase.from("game_rooms").select("id,status,ends_at").eq("id", roomId).eq("created_by", userId).single();
  if (error || !data) throw new Error("FORBIDDEN");
  return data;
}

async function resumeCompletedTeams(room: { id: string; status: string; ends_at: string | null }) {
  if (room.status !== "active" || !room.ends_at || new Date(room.ends_at).getTime() <= Date.now()) return;
  const admin = createAdminClient();
  const { data: teams, error } = await admin.from("teams").select("id").eq("room_id", room.id).eq("status", "completed_all");
  if (error) throw error;
  await Promise.all((teams ?? []).map(async (team) => {
    const { data: assignmentId, error: assignmentError } = await admin.rpc("assign_next_clue", { target_team_id: team.id, reveal_now: true });
    if (assignmentError) throw assignmentError;
    if (assignmentId) {
      const { error: updateError } = await admin.from("teams").update({ status: "searching" }).eq("id", team.id).eq("status", "completed_all");
      if (updateError) throw updateError;
    }
  }));
}
