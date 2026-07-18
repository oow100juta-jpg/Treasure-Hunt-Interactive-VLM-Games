"use client";

import { BINGO_TILES } from "@/lib/bingo-data";
import { BingoTileCard } from "@/components/bingo-tile";
import type { TileState } from "@/types/bingo";

interface BingoGridProps {
  completedTiles: string[];
  checkingTileId?: string | null;
  winningLineIndices?: number[];
}

export function BingoGrid({
  completedTiles,
  checkingTileId,
  winningLineIndices,
}: BingoGridProps) {
  const winSet = new Set(winningLineIndices ?? []);

  return (
    <div className="grid grid-cols-3 gap-3">
      {BINGO_TILES.map((tile, index) => {
        let state: TileState = "uncompleted";
        if (completedTiles.includes(tile.id)) state = "completed";
        else if (checkingTileId === tile.id) state = "checking";

        return (
          <BingoTileCard
            key={tile.id}
            tile={tile}
            index={index}
            state={state}
            isWinningTile={winSet.has(index)}
          />
        );
      })}
    </div>
  );
}
