export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RoomStatus = "lobby" | "active" | "ended";
export type TeamStatus =
  | "waiting"
  | "searching"
  | "uploading"
  | "reviewing"
  | "rejected"
  | "accepted"
  | "viewing_leaderboard"
  | "freeze_notice"
  | "completed_all"
  | "ended"
  | "disconnected";
export type Difficulty = "easy" | "medium" | "hard";
export type GamePhase = "lobby" | "active_leaderboard_visible" | "active_leaderboard_frozen" | "ended";
export type ProgressionStrategy = "random" | "easy_to_hard";

export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; display_name: string | null; role: "admin"; created_at: string }; Insert: { id: string; display_name?: string | null; role?: "admin" }; Update: { display_name?: string | null; role?: "admin" }; Relationships: [] };
      game_rooms: {
        Row: { id: string; name: string; code: string; status: RoomStatus; registration_open: boolean; maximum_teams: number; game_duration_seconds: number; leaderboard_visible_seconds: number; clue_progression_strategy: ProgressionStrategy; ending_title: string; ending_message: string; meeting_location: string; final_leaderboard_visible: boolean; created_by: string; created_at: string; started_at: string | null; leaderboard_freezes_at: string | null; ends_at: string | null; ended_at: string | null };
        Insert: { id?: string; name: string; code: string; status?: RoomStatus; registration_open?: boolean; maximum_teams?: number; game_duration_seconds: number; leaderboard_visible_seconds: number; clue_progression_strategy?: ProgressionStrategy; ending_title?: string; ending_message?: string; meeting_location?: string; final_leaderboard_visible?: boolean; created_by: string };
        Update: Partial<Database["public"]["Tables"]["game_rooms"]["Insert"]> & { started_at?: string | null; leaderboard_freezes_at?: string | null; ends_at?: string | null; ended_at?: string | null };
        Relationships: [];
      };
      teams: {
        Row: { id: string; room_id: string; name: string; normalized_name: string; participant_token_hash: string; status: TeamStatus; total_score: number; completed_clue_count: number; total_attempt_count: number; leaderboard_freeze_acknowledged_at: string | null; joined_at: string; last_seen_at: string; ended_at: string | null };
        Insert: { id?: string; room_id: string; name: string; normalized_name: string; participant_token_hash: string; status?: TeamStatus };
        Update: Partial<Database["public"]["Tables"]["teams"]["Row"]>;
        Relationships: [];
      };
      clues: {
        Row: { id: string; text: string; difficulty: Difficulty; category: string; expected_objects: Json; weight: number; order_group: number | null; is_active: boolean; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; text: string; difficulty: Difficulty; category: string; expected_objects?: Json; weight?: number; order_group?: number | null; is_active?: boolean; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["clues"]["Insert"]>;
        Relationships: [];
      };
      room_clues: {
        Row: { room_id: string; clue_id: string; added_at: string };
        Insert: { room_id: string; clue_id: string; added_at?: string };
        Update: never;
        Relationships: [];
      };
      clue_assignments: {
        Row: { id: string; room_id: string; team_id: string; clue_id: string; sequence_number: number; status: "assigned" | "active" | "reviewing" | "rejected" | "completed" | "expired"; is_revealed: boolean; assigned_at: string; first_viewed_at: string | null; completed_at: string | null; attempt_count: number; awarded_score: number; created_at: string };
        Insert: { id?: string; room_id: string; team_id: string; clue_id: string; sequence_number: number; status?: "assigned" | "active"; is_revealed?: boolean };
        Update: Partial<Database["public"]["Tables"]["clue_assignments"]["Row"]>;
        Relationships: [];
      };
      submissions: {
        Row: { id: string; room_id: string; team_id: string; assignment_id: string; image_path: string; attempt_number: number; evaluation_status: "pending" | "processing" | "completed" | "failed"; ai_decision: "accepted" | "rejected" | null; final_decision: "accepted" | "rejected" | null; decision_source: "ai" | "admin" | null; detected_object: string | null; evaluation_reason: string | null; confidence: number | null; overridden_by: string | null; override_reason: string | null; override_at: string | null; submitted_at: string; evaluated_at: string | null };
        Insert: { id?: string; room_id: string; team_id: string; assignment_id: string; image_path: string; attempt_number: number; evaluation_status?: "pending" | "processing" };
        Update: Partial<Database["public"]["Tables"]["submissions"]["Row"]>;
        Relationships: [];
      };
      score_events: { Row: { id: string; room_id: string; team_id: string; assignment_id: string; submission_id: string; event_type: string; points: number; metadata: Json; created_at: string }; Insert: Omit<Database["public"]["Tables"]["score_events"]["Row"], "id" | "created_at">; Update: never; Relationships: [] };
      participant_events: { Row: { id: string; room_id: string; team_id: string; event_type: string; metadata: Json; created_at: string }; Insert: { room_id: string; team_id: string; event_type: string; metadata?: Json }; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      start_game: { Args: { target_room_id: string; actor_id: string }; Returns: Json };
      end_game: { Args: { target_room_id: string; actor_id: string }; Returns: Json };
      assign_next_clue: { Args: { target_team_id: string; reveal_now?: boolean }; Returns: string | null };
      process_submission_decision: { Args: { target_submission_id: string; accepted: boolean; detected_object?: string | null; reason: string; confidence?: number | null; source?: string; admin_id?: string | null; override_reason?: string | null }; Returns: Json };
      begin_submission: { Args: { target_team_id: string; target_image_path: string }; Returns: Json };
      expire_room_if_needed: { Args: { target_room_id: string }; Returns: boolean };
      consume_api_rate_limit: { Args: { bucket_key: string; max_requests: number; window_seconds: number }; Returns: boolean };
      join_team: { Args: { target_room_code: string; target_team_name: string; target_normalized_name: string; target_token_hash: string }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
