import type { BingoTile } from "@/types/bingo";

/**
 * Bingo card tile definitions.
 *
 * To customise the game, edit this array.
 * - Each tile needs a unique `id`.
 * - `icon` is the name of a Lucide React icon.
 * - `acceptedTerms` is what the VLM uses for fuzzy matching.
 *
 * The grid is rendered in array order:
 *   [0][1][2]
 *   [3][4][5]
 *   [6][7][8]
 */
export const BINGO_TILES: BingoTile[] = [
  {
    id: "bottle",
    label: "Bottle",
    description: "Find a drinking bottle.",
    acceptedTerms: ["bottle", "water bottle", "drinking bottle", "plastic bottle", "glass bottle"],
    icon: "Wine",
  },
  {
    id: "backpack",
    label: "Backpack",
    description: "Find a backpack or bag.",
    acceptedTerms: ["backpack", "bag", "school bag", "rucksack", "knapsack"],
    icon: "Backpack",
  },
  {
    id: "chair",
    label: "Chair",
    description: "Find a chair or seat.",
    acceptedTerms: ["chair", "seat", "stool", "office chair", "bench"],
    icon: "Armchair",
  },
  {
    id: "laptop",
    label: "Laptop",
    description: "Find a laptop computer.",
    acceptedTerms: ["laptop", "notebook", "computer", "macbook", "chromebook"],
    icon: "Laptop",
  },
  {
    id: "cup",
    label: "Cup",
    description: "Find a cup or mug.",
    acceptedTerms: ["cup", "mug", "coffee cup", "tea cup", "tumbler"],
    icon: "Coffee",
  },
  {
    id: "plant",
    label: "Plant",
    description: "Find a plant or flower.",
    acceptedTerms: ["plant", "flower", "potted plant", "houseplant", "tree", "bush", "leaf"],
    icon: "Leaf",
  },
  {
    id: "keyboard",
    label: "Keyboard",
    description: "Find a keyboard.",
    acceptedTerms: ["keyboard", "computer keyboard", "mechanical keyboard", "wireless keyboard"],
    icon: "Keyboard",
  },
  {
    id: "door",
    label: "Door",
    description: "Find a door.",
    acceptedTerms: ["door", "doorway", "entrance", "gate", "wooden door", "glass door"],
    icon: "DoorOpen",
  },
  {
    id: "book",
    label: "Book",
    description: "Find a book.",
    acceptedTerms: ["book", "textbook", "notebook", "novel", "magazine", "journal"],
    icon: "BookOpen",
  },
];

/** Quick lookup map by tile id */
export const TILE_MAP = new Map(BINGO_TILES.map((t) => [t.id, t]));
