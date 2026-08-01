import type { GamePhase, RoomStatus } from "@/types/database";

export interface PhaseInput {
  status: RoomStatus;
  startedAt: string | null;
  leaderboardFreezesAt: string | null;
  endsAt: string | null;
  endedAt?: string | null;
}

export function getGamePhase(room: PhaseInput, now = new Date()): GamePhase {
  if (room.status === "ended" || room.endedAt) return "ended";
  if (room.status === "lobby" || !room.startedAt || !room.endsAt) return "lobby";
  const time = now.getTime();
  if (time >= new Date(room.endsAt).getTime()) return "ended";
  if (room.leaderboardFreezesAt && time >= new Date(room.leaderboardFreezesAt).getTime()) {
    return "active_leaderboard_frozen";
  }
  return "active_leaderboard_visible";
}

export function calculateGameTimestamps(now: Date, durationSeconds: number, leaderboardVisibleSeconds: number) {
  return {
    startedAt: now.toISOString(),
    leaderboardFreezesAt: new Date(now.getTime() + leaderboardVisibleSeconds * 1000).toISOString(),
    endsAt: new Date(now.getTime() + durationSeconds * 1000).toISOString(),
  };
}

export function isParticipantLeaderboardVisible(phase: GamePhase, finalVisible = false) {
  return phase === "active_leaderboard_visible" || (phase === "ended" && finalVisible);
}
