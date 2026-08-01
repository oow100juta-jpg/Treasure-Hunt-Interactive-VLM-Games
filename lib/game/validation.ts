import { z } from "zod";

export const joinSchema = z.object({
  roomCode: z.string().trim().min(3).max(12).transform((v) => v.toUpperCase()),
  teamName: z.string().trim().min(2).max(40),
});

export const roomSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(3).max(12).regex(/^[A-Za-z0-9-]+$/).transform((v) => v.toUpperCase()),
  maximumTeams: z.coerce.number().int().min(1).max(200),
  gameDurationMinutes: z.coerce.number().positive().max(480),
  leaderboardVisibleMinutes: z.coerce.number().min(0).max(480),
  clueProgressionStrategy: z.enum(["random", "easy_to_hard"]),
  endingTitle: z.string().trim().min(1).max(120),
  endingMessage: z.string().trim().max(500),
  meetingLocation: z.string().trim().max(160),
  finalLeaderboardVisible: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.leaderboardVisibleMinutes > value.gameDurationMinutes) {
    ctx.addIssue({ code: "custom", path: ["leaderboardVisibleMinutes"], message: "Leaderboard visibility cannot exceed game duration." });
  }
});

export const overrideSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  reason: z.string().trim().min(3).max(500),
});

export function normalizeTeamName(name: string) {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
