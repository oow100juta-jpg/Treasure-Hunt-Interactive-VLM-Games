import "server-only";

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function requireSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase is not configured. See .env.example.");
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".supabase.co")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL.");
  }
  if (!anonKey.startsWith("sb_publishable_") && !anonKey.startsWith("eyJ")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must contain a publishable or legacy anon key.");
  }
  if (anonKey.startsWith("eyJ")) {
    const role = legacyJwtRole(anonKey);
    if (role !== "anon") throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must contain an anon-role JWT.");
  }
  return { url, anonKey };
}

function legacyJwtRole(value: string) {
  try {
    return JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString()).role as unknown;
  } catch {
    return null;
  }
}
