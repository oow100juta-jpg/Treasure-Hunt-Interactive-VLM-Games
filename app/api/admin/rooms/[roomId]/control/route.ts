import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, assertSameOrigin } from "@/lib/http";

const schema = z.object({ action: z.enum(["start", "end", "close_registration", "open_registration", "reveal_final", "hide_final"]) });
export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    assertSameOrigin(request);
    const { roomId } = await context.params;
    const { supabase, user } = await requireAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid game control." }, { status: 400 });
    if (parsed.data.action === "open_registration") {
      const { data: room } = await supabase.from("game_rooms").select("status").eq("id", roomId).eq("created_by", user.id).single();
      if (room?.status !== "lobby") return NextResponse.json({ error: "Registration can only reopen before the game starts." }, { status: 409 });
    }
    let data: unknown;
    let error: { message: string } | null = null;
    if (parsed.data.action === "start") ({ data, error } = await supabase.rpc("start_game", { target_room_id: roomId, actor_id: user.id }));
    else if (parsed.data.action === "end") ({ data, error } = await supabase.rpc("end_game", { target_room_id: roomId, actor_id: user.id }));
    else {
      const changes = parsed.data.action === "close_registration" ? { registration_open: false } : parsed.data.action === "open_registration" ? { registration_open: true } : parsed.data.action === "reveal_final" ? { final_leaderboard_visible: true } : { final_leaderboard_visible: false };
      const result = await supabase.from("game_rooms").update(changes).eq("id", roomId).eq("created_by", user.id).select("*").single();
      data = result.data; error = result.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    const broadcaster = createAdminClient();
    const channel = broadcaster.channel(`room:${roomId}`);
    await channel.send({ type: "broadcast", event: "state_changed", payload: { action: parsed.data.action } });
    await broadcaster.removeChannel(channel);
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}
