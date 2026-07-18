// ─── Tile Definition ────────────────────────────────────────────
export type BingoTile = {
  id: string;
  label: string;
  description: string;
  acceptedTerms: string[];
  icon: string; // Lucide icon name
};

// ─── Tile UI State ──────────────────────────────────────────────
export type TileState = "uncompleted" | "checking" | "completed";

// ─── Submission ─────────────────────────────────────────────────
export type SubmissionStatus =
  | "idle"
  | "captured"
  | "uploading"
  | "correct"
  | "incorrect"
  | "error";

export type Submission = {
  tileId: string;
  result: "correct" | "incorrect";
  confidence?: number;
  reason?: string;
  detectedObject?: string;
  createdAt: string;
};

// ─── Team Session (localStorage) ────────────────────────────────
export type TeamSession = {
  teamName: string;
  completedTiles: string[];
  submissions: Submission[];
  startedAt: string;
};

// ─── API Request / Response ─────────────────────────────────────
export type ValidationRequest = {
  imageBase64: string;
  targetLabel: string;
  targetDescription: string;
  acceptedTerms: string[];
};

export type ValidationResponse = {
  correct: boolean;
  detectedObject: string;
  reason: string;
  confidence: number;
};
