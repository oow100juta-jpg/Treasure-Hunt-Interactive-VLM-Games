/**
 * Compress and resize an image for VLM submission.
 *
 * - Resizes longest edge to `maxEdge` (default 1024 px)
 * - Outputs JPEG at `quality` (default 0.8)
 * - Returns base64 data URI string
 */
export async function compressImage(
  source: Blob | string,
  maxEdge = 1024,
  quality = 0.8
): Promise<string> {
  const img = await loadImage(source);

  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    maxEdge
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Extract just the base64 string from a data URI.
 */
export function stripDataUri(dataUri: string): string {
  const idx = dataUri.indexOf(",");
  return idx >= 0 ? dataUri.slice(idx + 1) : dataUri;
}

/**
 * Get MIME type from a data URI.
 */
export function getMimeType(dataUri: string): string {
  const match = dataUri.match(/^data:([^;,]+)/);
  return match?.[1] ?? "image/jpeg";
}

/**
 * Validate that a MIME type is an accepted image format.
 */
export function isValidImageMime(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(mime);
}

// ─── Internal helpers ───────────────────────────────────────────

function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));

    if (typeof source === "string") {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

function calculateDimensions(
  w: number,
  h: number,
  maxEdge: number
): { width: number; height: number } {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };

  const ratio = w / h;
  if (w > h) {
    return { width: maxEdge, height: Math.round(maxEdge / ratio) };
  }
  return { width: Math.round(maxEdge * ratio), height: maxEdge };
}
