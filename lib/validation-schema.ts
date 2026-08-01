import { z } from "zod";

/**
 * Schema for the client → server request body.
 */
export const validationRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(100, "Image data is too short")
    .max(10_000_000, "Image data exceeds 10 MB limit"),
  targetLabel: z.string().min(1).max(100),
  targetDescription: z.string().min(1).max(500),
  acceptedTerms: z.array(z.string().max(100)).min(1).max(20),
});

/**
 * Schema for the VLM's JSON output — lenient because models are unreliable.
 */
export const vlmResponseSchema = z.object({
  correct: z.boolean(),
  detectedObject: z.string().default("unknown"),
  reason: z.string().default("No reason provided."),
  confidence: z.number().min(0).max(1).default(0),
});

/**
 * Parse raw model text into a validated response.
 *
 * Handles:
 * - Markdown code fences
 * - Leading/trailing whitespace
 * - Embedded JSON in larger text
 * - Invalid JSON gracefully
 */
export function parseVLMResponse(raw: string): z.infer<typeof vlmResponseSchema> {
  if (!raw || typeof raw !== "string") {
    throw new Error("VLM returned empty or non-string response.");
  }

  // Strip markdown code fences
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    return vlmResponseSchema.parse(parsed);
  } catch {
    // Fall through to regex extraction
  }

  // Try to extract JSON object from surrounding text
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("VLM response does not contain valid JSON.");
  }

  try {
    const parsed = JSON.parse(match[0]);
    return vlmResponseSchema.parse(parsed);
  } catch {
    throw new Error("VLM returned malformed JSON.");
  }
}
