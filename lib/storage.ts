import type { TeamSession, Submission } from "@/types/bingo";

const ACTIVE_TEAM_KEY = "ai-bingo-active-team";

function teamKey(teamName: string): string {
  return `ai-bingo-team-${teamName.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

// ─── Active team ────────────────────────────────────────────────

export function getActiveTeam(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_TEAM_KEY);
}

export function setActiveTeam(name: string): void {
  localStorage.setItem(ACTIVE_TEAM_KEY, name.trim());
}

export function clearActiveTeam(): void {
  localStorage.removeItem(ACTIVE_TEAM_KEY);
}

// ─── Team session ───────────────────────────────────────────────

export function getTeamSession(teamName: string): TeamSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(teamKey(teamName));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TeamSession;
  } catch {
    return null;
  }
}

export function saveTeamSession(session: TeamSession): void {
  localStorage.setItem(teamKey(session.teamName), JSON.stringify(session));
}

export function createTeamSession(teamName: string): TeamSession {
  const session: TeamSession = {
    teamName: teamName.trim(),
    completedTiles: [],
    submissions: [],
    startedAt: new Date().toISOString(),
  };
  saveTeamSession(session);
  return session;
}

// ─── Tile completion ────────────────────────────────────────────

export function markTileCompleted(
  teamName: string,
  tileId: string,
  submission: Omit<Submission, "tileId" | "createdAt">
): void {
  const session = getTeamSession(teamName) ?? createTeamSession(teamName);

  if (!session.completedTiles.includes(tileId)) {
    session.completedTiles.push(tileId);
  }

  session.submissions.push({
    ...submission,
    tileId,
    createdAt: new Date().toISOString(),
  });

  saveTeamSession(session);
}

export function addFailedSubmission(
  teamName: string,
  tileId: string,
  submission: Omit<Submission, "tileId" | "createdAt">
): void {
  const session = getTeamSession(teamName) ?? createTeamSession(teamName);

  session.submissions.push({
    ...submission,
    tileId,
    createdAt: new Date().toISOString(),
  });

  saveTeamSession(session);
}

// ─── Reset ──────────────────────────────────────────────────────

export function resetProgress(teamName: string): void {
  const session = getTeamSession(teamName);
  if (session) {
    session.completedTiles = [];
    session.submissions = [];
    session.startedAt = new Date().toISOString();
    saveTeamSession(session);
  }
}

export function clearTeam(): void {
  const teamName = getActiveTeam();
  if (teamName) {
    localStorage.removeItem(teamKey(teamName));
  }
  clearActiveTeam();
}
