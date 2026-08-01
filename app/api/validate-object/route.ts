import { NextRequest, NextResponse } from "next/server";
import { validationRequestSchema } from "@/lib/validation-schema";
import { validateObject } from "@/lib/huggingface";
import { isValidImageMime, getMimeType } from "@/lib/image-utils";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 15; // max requests per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  try {
    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "The AI service is currently busy. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    // Parse body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // Validate with Zod
    const parsed = validationRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { imageBase64, targetLabel, targetDescription, acceptedTerms } = parsed.data;

    // Validate MIME type
    if (imageBase64.startsWith("data:")) {
      const mime = getMimeType(imageBase64);
      if (!isValidImageMime(mime)) {
        return NextResponse.json(
          { error: "Only JPEG, PNG, and WebP images are accepted." },
          { status: 400 }
        );
      }
    }

    // Call VLM
    const result = await validateObject({
      imageBase64,
      targetLabel,
      targetDescription,
      acceptedTerms,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[validate-object]", error);

    const message =
      error instanceof Error
        ? error.message
        : "The AI could not check your photo right now. Please try again.";

    const status =
      error instanceof Error && error.message.includes("busy") ? 429 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
