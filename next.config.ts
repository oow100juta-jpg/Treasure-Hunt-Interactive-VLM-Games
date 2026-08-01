import type { NextConfig } from "next";

const publicSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (publicSupabaseKey?.startsWith("sb_secret_")) {
  throw new Error("Refusing to build: NEXT_PUBLIC_SUPABASE_ANON_KEY contains a secret Supabase key.");
}
if (publicSupabaseKey?.startsWith("eyJ")) {
  let legacyRole: unknown;
  try {
    legacyRole = JSON.parse(Buffer.from(publicSupabaseKey.split(".")[1] ?? "", "base64url").toString()).role;
  } catch {
    // Runtime configuration validation will report malformed public keys.
  }
  if (legacyRole === "service_role") {
    throw new Error("Refusing to build: a legacy service-role JWT was placed in NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

const isDevelopment = process.env.NODE_ENV === "development";
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();
const supabaseWebSocketOrigin = supabaseOrigin.replace(/^http/, "ws");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWebSocketOrigin}`,
  `img-src 'self' blob: data: ${supabaseOrigin}`,
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
