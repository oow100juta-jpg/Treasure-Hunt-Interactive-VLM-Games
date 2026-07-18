import { BINGO_TILES } from "./bingo-data";

/**
 * All possible bingo lines (indices into the 3×3 grid).
 *
 *  0 | 1 | 2
 *  ---------
 *  3 | 4 | 5
 *  ---------
 *  6 | 7 | 8
 */
export const WINNING_LINES: number[][] = [
  // rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // columns
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // diagonals
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * Check whether any winning line is fully completed.
 * @returns The first winning line (array of indices), or `null`.
 */
export function checkBingo(completedTileIds: string[]): number[] | null {
  const completedSet = new Set(completedTileIds);

  for (const line of WINNING_LINES) {
    const allCompleted = line.every((idx) => {
      const tile = BINGO_TILES[idx];
      return tile && completedSet.has(tile.id);
    });
    if (allCompleted) return line;
  }

  return null;
}

/**
 * Get all winning lines (there may be more than one).
 */
export function getAllWinningLines(completedTileIds: string[]): number[][] {
  const completedSet = new Set(completedTileIds);

  return WINNING_LINES.filter((line) =>
    line.every((idx) => {
      const tile = BINGO_TILES[idx];
      return tile && completedSet.has(tile.id);
    })
  );
}
