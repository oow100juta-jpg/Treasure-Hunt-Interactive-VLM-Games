import "server-only";
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
    public readonly responseHeaders?: HeadersInit,
  ) {
    super(publicMessage);
    this.name = "HttpError";
  }
}

export function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new HttpError(403, "Cross-site requests are not allowed.");
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new HttpError(400, "Invalid request URL.");
  }
  if (origin !== requestOrigin) {
    throw new HttpError(403, "Cross-site requests are not allowed.");
  }
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const known = error instanceof HttpError ? error : null;
  const status = known?.status ?? (message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500);
  const publicMessage = known?.publicMessage
    ?? (status === 401
      ? "Please join the room again."
      : status === 403
        ? "You do not have access."
        : "The server could not complete this request.");
  if (status >= 500) console.error("[KCV API]", error);
  else console.warn(`[KCV API] ${status}: ${publicMessage}`);
  return NextResponse.json(
    { error: publicMessage },
    { status, headers: { "Cache-Control": "no-store", ...known?.responseHeaders } },
  );
}
