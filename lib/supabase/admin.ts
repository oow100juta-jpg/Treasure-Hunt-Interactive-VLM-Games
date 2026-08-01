import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server credentials are not configured.");
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".supabase.co")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL.");
  }
  if (!serviceKey.startsWith("sb_secret_") && !serviceKey.startsWith("eyJ")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must contain a service-role or secret key.");
  }
  if (serviceKey.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY cannot use a publishable key.");
  }
  if (serviceKey.startsWith("eyJ") && legacyJwtRole(serviceKey) !== "service_role") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must contain a service-role JWT.");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function legacyJwtRole(value: string) {
  try {
    return JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString()).role as unknown;
  } catch {
    return null;
  }
}
