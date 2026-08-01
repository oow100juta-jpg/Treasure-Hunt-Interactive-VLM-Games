import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { HttpError } from "@/lib/http";

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")
    ?? request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function rateLimitKey(scope: string, subject: string) {
  const secret = process.env.PARTICIPANT_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PARTICIPANT_TOKEN_SECRET must be at least 32 characters.");
  }
  return createHmac("sha256", secret).update(`${scope}:${subject}`).digest("hex");
}

export async function enforceRateLimit(
  supabase: SupabaseClient<Database>,
  input: { scope: string; subject: string; limit: number; windowSeconds: number },
) {
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    bucket_key: rateLimitKey(input.scope, input.subject),
    max_requests: input.limit,
    window_seconds: input.windowSeconds,
  });
  if (error) throw error;
  if (!data) {
    throw new HttpError(429, "Too many requests. Please wait and try again.", {
      "Retry-After": String(input.windowSeconds),
    });
  }
}
