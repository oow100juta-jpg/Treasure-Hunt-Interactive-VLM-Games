"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, PartyPopper, Eye, RotateCcw } from "lucide-react";

interface BingoCelebrationProps {
  teamName: string;
  winningLine: number[];
  completedCount: number;
  totalCount: number;
  onViewCard: () => void;
  onPlayAgain: () => void;
}

export function BingoCelebration({
  teamName,
  winningLine,
  completedCount,
  totalCount,
  onViewCard,
  onPlayAgain,
}: BingoCelebrationProps) {
  const [showContent, setShowContent] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<
    { id: number; left: number; delay: number; color: string; size: number }[]
  >([]);

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Generate confetti
  const generateConfetti = useCallback(() => {
    const colors = [
      "#8B5CF6",
      "#A855F7",
      "#F59E0B",
      "#10B981",
      "#EC4899",
      "#3B82F6",
      "#F43F5E",
      "#06B6D4",
    ];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8,
    }));
  }, []);

  useEffect(() => {
    setConfettiPieces(generateConfetti());
  }, [generateConfetti]);

  const lineDescription = (line: number[]): string => {
    if (line[0] === 0 && line[1] === 1 && line[2] === 2) return "Top Row";
    if (line[0] === 3 && line[1] === 4 && line[2] === 5) return "Middle Row";
    if (line[0] === 6 && line[1] === 7 && line[2] === 8) return "Bottom Row";
    if (line[0] === 0 && line[1] === 3 && line[2] === 6) return "Left Column";
    if (line[0] === 1 && line[1] === 4 && line[2] === 7) return "Center Column";
    if (line[0] === 2 && line[1] === 5 && line[2] === 8) return "Right Column";
    if (line[0] === 0 && line[1] === 4 && line[2] === 8) return "Diagonal ↘";
    if (line[0] === 2 && line[1] === 4 && line[2] === 6) return "Diagonal ↙";
    return "Bingo Line";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Confetti */}
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            backgroundColor: piece.color,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
          }}
        />
      ))}

      {/* Content */}
      <div
        className={`relative mx-4 max-w-sm w-full bg-white rounded-3xl p-8 shadow-2xl text-center transition-all duration-700 ${
          showContent
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-90 translate-y-8"
        }`}
      >
        {/* Trophy */}
        <div className="relative mx-auto mb-4 w-20 h-20">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-400/30 animate-bounce-slow">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <PartyPopper className="absolute -top-2 -right-2 w-8 h-8 text-violet-500 animate-spin-slow" />
        </div>

        {/* Title */}
        <h2 className="text-3xl font-black bg-gradient-to-r from-violet-600 via-purple-600 to-amber-500 bg-clip-text text-transparent mb-2">
          BINGO!
        </h2>

        <p className="text-gray-600 text-sm mb-6">
          Team <span className="font-bold text-violet-600">{teamName}</span>{" "}
          completed the treasure hunt!
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-violet-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-violet-600">
              {completedCount}/{totalCount}
            </p>
            <p className="text-xs text-gray-500">Objects Found</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-lg font-bold text-amber-600">
              {lineDescription(winningLine)}
            </p>
            <p className="text-xs text-gray-500">Winning Line</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <Button
            onClick={onViewCard}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg shadow-purple-500/25"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Bingo Card
          </Button>
          <Button
            variant="ghost"
            onClick={onPlayAgain}
            className="w-full h-10 rounded-xl text-gray-600"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Play Again
          </Button>
        </div>
      </div>
    </div>
  );
}
