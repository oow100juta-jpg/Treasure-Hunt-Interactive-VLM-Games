import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createParticipantToken, setParticipantCookie } from "@/lib/game/session";
import { joinSchema, normalizeTeamName } from "@/lib/game/validation";
import { apiError, assertSameOrigin } from "@/lib/http";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = joinSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const { roomCode, teamName } = parsed.data;
    const supabase = createAdminClient();
    await enforceRateLimit(supabase, {
      scope: "participant-join",
      subject: getClientIp(request),
      limit: 120,
      windowSeconds: 60,
    });
    const { token, hash } = createParticipantToken();
    const { data, error } = await supabase.rpc("join_team", {
      target_room_code: roomCode,
      target_team_name: teamName,
      target_normalized_name: normalizeTeamName(teamName),
      target_token_hash: hash,
    });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That team name is already taken in this room." }, { status: 409 });
      if (error.message.includes("Room not found")) return NextResponse.json({ error: "Room not found. Check the code and try again." }, { status: 404 });
      if (error.message.includes("Game has ended")) return NextResponse.json({ error: "This game has already ended." }, { status: 409 });
      if (error.message.includes("Registration closed")) return NextResponse.json({ error: "Registration is closed for this room." }, { status: 409 });
      if (error.message.includes("Room team limit reached")) return NextResponse.json({ error: "This room has reached its team limit." }, { status: 409 });
      throw error;
    }
    const joined = data as { roomCode: string; team: { id: string; name: string } } | null;
    if (!joined?.team?.id) throw new Error("Team registration returned an invalid result.");
    await setParticipantCookie(joined.team.id, token);
    return NextResponse.json({ roomCode: joined.roomCode, teamName: joined.team.name });
  } catch (error) {
    return apiError(error);
  }
}
