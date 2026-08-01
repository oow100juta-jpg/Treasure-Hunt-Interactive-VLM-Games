export interface RankableTeam {
  id: string;
  name: string;
  totalScore: number;
  completedClueCount: number;
  totalAttemptCount: number;
  acceptedFirstTryCount: number;
  latestCompletionAt: string | null;
  status?: string;
}

export function rankTeams<T extends RankableTeam>(teams: T[]): Array<T & { rank: number }> {
  return [...teams]
    .sort((a, b) =>
      b.totalScore - a.totalScore ||
      b.completedClueCount - a.completedClueCount ||
      a.totalAttemptCount - b.totalAttemptCount ||
      compareCompletion(a.latestCompletionAt, b.latestCompletionAt) ||
      a.name.localeCompare(b.name)
    )
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

function compareCompletion(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}
