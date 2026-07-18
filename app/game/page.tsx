"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { GameHeader } from "@/components/game-header";
import { ProgressSummary } from "@/components/progress-summary";
import { BingoGrid } from "@/components/bingo-grid";
import { ResetProgressDialog } from "@/components/reset-progress-dialog";
import { BingoCelebration } from "@/components/bingo-celebration";
import { BINGO_TILES } from "@/lib/bingo-data";
import { checkBingo, getAllWinningLines } from "@/lib/bingo-utils";
import {
  getActiveTeam,
  getTeamSession,
  resetProgress,
  clearTeam,
} from "@/lib/storage";

export default function GamePage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState<string>("");
  const [completedTiles, setCompletedTiles] = useState<string[]>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [winningIndices, setWinningIndices] = useState<number[]>([]);
  const [isMockMode, setIsMockMode] = useState(false);

  // Load team data
  const loadData = useCallback(() => {
    const team = getActiveTeam();
    if (!team) {
      router.replace("/");
      return;
    }
    setTeamName(team);

    const session = getTeamSession(team);
    if (session) {
      setCompletedTiles(session.completedTiles);

      // Check for bingo
      const line = checkBingo(session.completedTiles);
      if (line) {
        setWinningLine(line);
        const allLines = getAllWinningLines(session.completedTiles);
        const allIndices = [...new Set(allLines.flat())];
        setWinningIndices(allIndices);
      }
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check mock mode from server
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => setIsMockMode(data.mockMode === true))
      .catch(() => {});
  }, []);

  // Listen for storage changes (e.g., other tabs)
  useEffect(() => {
    const handleStorage = () => loadData();
    window.addEventListener("storage", handleStorage);
    // Also listen for custom event from tile page
    window.addEventListener("bingo-progress-updated", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("bingo-progress-updated", handleStorage);
    };
  }, [loadData]);

  // Re-check on focus (returning from tile page)
  useEffect(() => {
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    // Also poll when page becomes visible (handles mobile app switching)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadData]);

  const handleResetProgress = () => {
    if (!teamName) return;
    resetProgress(teamName);
    setCompletedTiles([]);
    setWinningLine(null);
    setWinningIndices([]);
    setShowCelebration(false);
    toast.success("Progress has been reset!");
  };

  const handleChangeTeam = () => {
    clearTeam();
    router.replace("/");
  };

  const handleViewBingoAfterWin = () => {
    setShowCelebration(false);
  };

  const handlePlayAgain = () => {
    if (!teamName) return;
    if (confirm("Start a new game? Your current progress will be cleared.")) {
      handleResetProgress();
    }
  };

  // Show celebration when bingo is first detected
  useEffect(() => {
    if (winningLine && !showCelebration) {
      // Small delay for the tile animation to finish
      const timer = setTimeout(() => setShowCelebration(true), 600);
      return () => clearTimeout(timer);
    }
  }, [winningLine, showCelebration]);

  if (!teamName) return null;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-violet-50/30">
      <Toaster position="top-center" richColors />

      <GameHeader
        teamName={teamName}
        isMockMode={isMockMode}
        onResetProgress={() => setShowResetDialog(true)}
        onChangeTeam={handleChangeTeam}
      />

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        <ProgressSummary
          completedCount={completedTiles.length}
          totalCount={BINGO_TILES.length}
          hasBingo={!!winningLine}
        />

        <BingoGrid
          completedTiles={completedTiles}
          winningLineIndices={winningIndices}
        />
      </main>

      <ResetProgressDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={handleResetProgress}
      />

      {showCelebration && winningLine && (
        <BingoCelebration
          teamName={teamName}
          winningLine={winningLine}
          completedCount={completedTiles.length}
          totalCount={BINGO_TILES.length}
          onViewCard={handleViewBingoAfterWin}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
