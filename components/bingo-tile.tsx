"use client";

import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { BingoTile, TileState } from "@/types/bingo";
import { cn } from "@/lib/utils";

interface BingoTileProps {
  tile: BingoTile;
  index: number;
  state: TileState;
  isWinningTile?: boolean;
}

// Dynamic icon lookup
function getTileIcon(iconName: string) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
  return Icon ?? LucideIcons.HelpCircle;
}

export function BingoTileCard({ tile, index, state, isWinningTile }: BingoTileProps) {
  const router = useRouter();
  const Icon = getTileIcon(tile.icon);

  const handleClick = () => {
    if (state === "completed" || state === "checking") return;
    router.push(`/game/tile/${tile.id}`);
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === "completed" || state === "checking"}
      aria-label={`${tile.label} — ${state === "completed" ? "Found" : state === "checking" ? "Checking" : "Not found yet"}`}
      className={cn(
        "relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 p-2 transition-all duration-300 border-2 min-h-[100px]",
        // Uncompleted
        state === "uncompleted" && [
          "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-violet-200 hover:scale-[1.03] active:scale-[0.97] cursor-pointer",
        ],
        // Checking
        state === "checking" && [
          "bg-violet-50 border-violet-200 cursor-wait",
        ],
        // Completed
        state === "completed" && [
          "bg-gradient-to-br from-emerald-400 to-green-500 border-emerald-300 cursor-default shadow-md shadow-emerald-500/20",
        ],
        // Winning tile glow
        isWinningTile && state === "completed" && [
          "ring-2 ring-amber-400 ring-offset-2 shadow-lg shadow-amber-400/30 animate-pulse-slow",
        ]
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Icon */}
      {state === "checking" ? (
        <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
      ) : state === "completed" ? (
        <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
          <Check className="w-5 h-5 text-white" strokeWidth={3} />
        </div>
      ) : (
        <Icon className="w-7 h-7 text-gray-400 group-hover:text-violet-500 transition-colors" />
      )}

      {/* Label */}
      <span
        className={cn(
          "text-xs font-semibold text-center leading-tight",
          state === "completed" ? "text-white" : "text-gray-700",
          state === "checking" && "text-violet-600"
        )}
      >
        {state === "checking" ? "Checking..." : state === "completed" ? "Found ✓" : tile.label}
      </span>
    </button>
  );
}
