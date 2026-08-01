import type { Difficulty } from "@/types/database";

const multipliers: Record<Difficulty, number> = { easy: 1, medium: 1.2, hard: 1.5 };

export function calculateScore(attempt: number, difficulty: Difficulty, weight = 1) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Attempt must be a positive integer");
  const base = Math.max(60, 110 - attempt * 10);
  return Math.round(base * multipliers[difficulty] * weight);
}
