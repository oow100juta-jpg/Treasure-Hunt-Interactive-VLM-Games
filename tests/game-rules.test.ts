import { describe, expect, it } from "vitest";
import { getGamePhase, calculateGameTimestamps, isParticipantLeaderboardVisible } from "../lib/game/phase";
import { calculateScore } from "../lib/game/scoring";
import { rankTeams } from "../lib/game/leaderboard";
import { roomSchema } from "../lib/game/validation";

describe("room timing and phase", () => {
  const base = { name:"Test", code:"TEST", maximumTeams:10, gameDurationMinutes:30, leaderboardVisibleMinutes:20, clueProgressionStrategy:"easy_to_hard" as const, endingTitle:"Done", endingMessage:"", meetingLocation:"", finalLeaderboardVisible:false };
  it("rejects non-positive game duration",()=>expect(roomSchema.safeParse({...base,gameDurationMinutes:0}).success).toBe(false));
  it("rejects freeze after game end",()=>expect(roomSchema.safeParse({...base,leaderboardVisibleMinutes:31}).success).toBe(false));
  it("allows a zero-minute leaderboard",()=>expect(roomSchema.safeParse({...base,leaderboardVisibleMinutes:0}).success).toBe(true));
  it("uses one shared timestamp to calculate boundaries",()=>{const now=new Date("2026-01-01T00:00:00Z");const value=calculateGameTimestamps(now,1800,1200);expect(value.startedAt).toBe(now.toISOString());expect(value.leaderboardFreezesAt).toBe("2026-01-01T00:20:00.000Z");expect(value.endsAt).toBe("2026-01-01T00:30:00.000Z")});
  it("calculates every game phase from server timestamps",()=>{const room={status:"active" as const,startedAt:"2026-01-01T00:00:00Z",leaderboardFreezesAt:"2026-01-01T00:20:00Z",endsAt:"2026-01-01T00:30:00Z"};expect(getGamePhase(room,new Date("2026-01-01T00:10:00Z"))).toBe("active_leaderboard_visible");expect(getGamePhase(room,new Date("2026-01-01T00:25:00Z"))).toBe("active_leaderboard_frozen");expect(getGamePhase(room,new Date("2026-01-01T00:30:00Z"))).toBe("ended")});
  it("hides participant ranking after freeze",()=>expect(isParticipantLeaderboardVisible("active_leaderboard_frozen")).toBe(false));
  it("can reveal a final participant ranking explicitly",()=>expect(isParticipantLeaderboardVisible("ended",true)).toBe(true));
});

describe("scoring and ranking",()=>{
  it("scores attempts with floors and multipliers",()=>{expect(calculateScore(1,"easy")).toBe(100);expect(calculateScore(2,"medium")).toBe(108);expect(calculateScore(9,"hard")).toBe(90)});
  it("uses deterministic leaderboard tie breakers",()=>{const rows=rankTeams([{id:"b",name:"Beta",totalScore:100,completedClueCount:1,totalAttemptCount:3,acceptedFirstTryCount:0,latestCompletionAt:"2026-01-01T00:03:00Z"},{id:"a",name:"Alpha",totalScore:100,completedClueCount:1,totalAttemptCount:2,acceptedFirstTryCount:0,latestCompletionAt:"2026-01-01T00:04:00Z"}]);expect(rows[0].id).toBe("a");expect(rows[0].rank).toBe(1)});
});
