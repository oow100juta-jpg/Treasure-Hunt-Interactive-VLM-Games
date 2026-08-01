import type { Difficulty, GamePhase } from "@/types/database";
import { calculateGameTimestamps, getGamePhase, isParticipantLeaderboardVisible } from "./phase";
import { calculateScore } from "./scoring";

export type EngineClue = { id: string; difficulty: Difficulty; active: boolean };
export type EngineAssignment = { id: string; teamId: string; clueId: string; status: "active" | "completed" | "expired"; attempts: number; score: number };
export type EngineTeam = { id: string; roomId: string; score: number; completed: number; freezeAcknowledged: boolean };
export type EngineRoom = { id: string; status: "lobby" | "active" | "ended"; duration: number; leaderboardDuration: number; startedAt: string | null; freezesAt: string | null; endsAt: string | null };
export type EngineState = { room: EngineRoom; teams: EngineTeam[]; clues: EngineClue[]; assignments: EngineAssignment[]; processedSubmissionIds: Set<string> };

export function startEngineGame(state: EngineState, now: Date) {
  if (state.room.status === "active") return { state, idempotent: true };
  if (state.room.status === "ended") throw new Error("Game has ended");
  if (!state.teams.length) throw new Error("At least one team is required");
  const timestamps = calculateGameTimestamps(now, state.room.duration, state.room.leaderboardDuration);
  state.room = { ...state.room, status: "active", startedAt: timestamps.startedAt, freezesAt: timestamps.leaderboardFreezesAt, endsAt: timestamps.endsAt };
  state.teams.forEach((team) => assignEngineClue(state, team.id));
  return { state, idempotent: false };
}

export function endEngineGame(state: EngineState, now: Date) {
  if (state.room.status === "ended") return { state, idempotent: true };
  state.room.status = "ended"; state.room.endsAt = now.toISOString();
  state.assignments.forEach((item) => { if (item.status === "active") item.status = "expired"; });
  return { state, idempotent: false };
}

export function assignEngineClue(state: EngineState, teamId: string) {
  const existing = state.assignments.find((item) => item.teamId === teamId && item.status === "active");
  if (existing) return existing;
  const used = new Set(state.assignments.filter((item) => item.teamId === teamId).map((item) => item.clueId));
  const clue = state.clues.find((item) => item.active && !used.has(item.id));
  if (!clue) return null;
  const assignment = { id: `${teamId}-${clue.id}`, teamId, clueId: clue.id, status: "active" as const, attempts: 0, score: 0 };
  state.assignments.push(assignment); return assignment;
}

export function acceptEngineSubmission(state: EngineState, submissionId: string, assignmentId: string) {
  if (state.processedSubmissionIds.has(submissionId)) return { idempotent: true, next: state.assignments.find((a) => a.status === "active") ?? null };
  if (!canSubmit(state, assignmentId, new Date())) throw new Error("Submission blocked");
  const assignment = state.assignments.find((item) => item.id === assignmentId)!;
  assignment.attempts += 1; assignment.status = "completed";
  const clue = state.clues.find((item) => item.id === assignment.clueId)!;
  assignment.score = calculateScore(assignment.attempts, clue.difficulty);
  const team = state.teams.find((item) => item.id === assignment.teamId)!;
  team.score += assignment.score; team.completed += 1; state.processedSubmissionIds.add(submissionId);
  return { idempotent: false, next: assignEngineClue(state, team.id) };
}

export function canSubmit(state: EngineState, assignmentId: string, now: Date) {
  const phase = getGamePhase({ status: state.room.status, startedAt: state.room.startedAt, leaderboardFreezesAt: state.room.freezesAt, endsAt: state.room.endsAt }, now);
  return (phase === "active_leaderboard_visible" || phase === "active_leaderboard_frozen") && state.assignments.some((item) => item.id === assignmentId && item.status === "active");
}

export function participantCanReadAssignment(teamId: string, assignment: EngineAssignment) { return assignment.teamId === teamId; }
export function participantCanUpdateScore() { return false; }
export function shouldShowFreezeNotice(phase: GamePhase, acknowledged: boolean) { return phase === "active_leaderboard_frozen" && !acknowledged; }
export function boardAccess(phase: GamePhase, admin: boolean) { return admin || isParticipantLeaderboardVisible(phase); }

export function overrideDecision(input: { previous: "accepted" | "rejected" | null; decision: "accepted" | "rejected"; reason: string }) {
  if (input.reason.trim().length < 3) throw new Error("Override reason required");
  if (input.previous === input.decision) return { idempotent: true, decision: input.decision };
  return { idempotent: false, decision: input.decision, source: "admin" as const };
}
