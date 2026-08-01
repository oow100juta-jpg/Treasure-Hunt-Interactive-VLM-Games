import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-kcv_participant" : "kcv_participant";

function hashToken(token: string) {
  const secret = process.env.PARTICIPANT_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error("PARTICIPANT_TOKEN_SECRET must be at least 32 characters.");
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function createParticipantToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export async function setParticipantCookie(teamId: string, token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, `${teamId}.${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function requireParticipant(expectedRoomCode?: string) {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) throw new Error("UNAUTHORIZED");
  const splitAt = value.indexOf(".");
  if (splitAt < 1) throw new Error("UNAUTHORIZED");
  const teamId = value.slice(0, splitAt);
  const token = value.slice(splitAt + 1);
  const supabase = createAdminClient();
  const { data: team } = await supabase.from("teams").select("*, game_rooms(*)").eq("id", teamId).maybeSingle();
  if (!team) throw new Error("UNAUTHORIZED");
  const expected = Buffer.from(team.participant_token_hash, "hex");
  const actual = Buffer.from(hashToken(token), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("UNAUTHORIZED");
  const room = team.game_rooms as unknown as DatabaseRoom;
  if (expectedRoomCode && room.code !== expectedRoomCode.toUpperCase()) throw new Error("FORBIDDEN");
  return { supabase, team, room };
}

type DatabaseRoom = import("@/types/database").Database["public"]["Tables"]["game_rooms"]["Row"];
