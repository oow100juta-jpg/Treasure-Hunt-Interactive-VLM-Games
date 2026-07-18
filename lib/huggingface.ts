import OpenAI from "openai";
import type { ValidationRequest, ValidationResponse } from "@/types/bingo";
import { parseVLMResponse } from "./validation-schema";

// ─── Configuration ──────────────────────────────────────────────

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const HF_MODEL = process.env.HUGGINGFACE_MODEL_ID ?? "google/gemma-4-31B-it:novita";
const USE_MOCK = process.env.USE_MOCK_VLM === "true";
const CONFIDENCE_THRESHOLD = 0.65;
const REQUEST_TIMEOUT_MS = 45_000;

// ─── OpenAI-compatible client for Hugging Face Router ───────────

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!HF_TOKEN && !USE_MOCK) {
      throw new Error("HUGGINGFACE_API_TOKEN is not set.");
    }
    client = new OpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: HF_TOKEN ?? "mock",
    });
  }
  return client;
}

// ─── Prompt template ────────────────────────────────────────────

function buildPrompt(req: ValidationRequest): string {
  return `You are an image verification system for a visual treasure hunt game.

Your task is to determine whether the submitted image clearly contains the target object.

Target object:
${req.targetLabel}

Target description:
${req.targetDescription}

Accepted related terms:
${req.acceptedTerms.join(", ")}

Rules:
1. The target object must be visibly present in the image.
2. Do not mark the image correct based only on text, labels, posters, screens, drawings, or photographs of the object.
3. The real physical object should be visible.
4. The object does not need to fill the image, but it must be recognizable.
5. If the image is blurry, dark, blocked, or ambiguous, mark it incorrect.
6. Ignore unrelated objects.
7. Be conservative. When uncertain, return incorrect.

Return only valid JSON using this format:

{
  "correct": true,
  "detectedObject": "short object name",
  "reason": "short explanation",
  "confidence": 0.0
}`;
}

// ─── Mock response (for development without API token) ──────────

function getMockResponse(req: ValidationRequest): ValidationResponse {
  const isCorrect = Math.random() > 0.35;
  return {
    correct: isCorrect,
    detectedObject: isCorrect ? req.targetLabel.toLowerCase() : "unknown object",
    reason: isCorrect
      ? `The image clearly shows a ${req.targetLabel.toLowerCase()}.`
      : `The target object (${req.targetLabel.toLowerCase()}) was not clearly visible in the image.`,
    confidence: isCorrect ? 0.75 + Math.random() * 0.2 : 0.15 + Math.random() * 0.3,
  };
}

// ─── Main validation function ───────────────────────────────────

export async function validateObject(
  req: ValidationRequest
): Promise<ValidationResponse> {
  // Mock mode
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
    return getMockResponse(req);
  }

  const oai = getClient();
  const prompt = buildPrompt(req);

  // Build the image data URL
  const imageDataUrl = req.imageBase64.startsWith("data:")
    ? req.imageBase64
    : `data:image/jpeg;base64,${req.imageBase64}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const completion = await oai.chat.completions.create(
      {
        model: HF_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0,
      },
      { signal: controller.signal }
    );

    const raw = completion?.choices?.[0]?.message?.content ?? "";

    if (!raw.trim()) {
      throw new Error("VLM returned an empty response.");
    }

    const parsed = parseVLMResponse(raw);

    // Server-side confidence threshold
    return {
      ...parsed,
      correct: parsed.correct && parsed.confidence >= CONFIDENCE_THRESHOLD,
    };
  } catch (error: unknown) {
    // Re-throw with friendly messages
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("The AI took too long to respond. Please try again.");
      }
      if (error.message.includes("429") || error.message.includes("rate")) {
        throw new Error("The AI service is currently busy. Please wait a moment and try again.");
      }
      if (error.message.includes("503") || error.message.includes("loading")) {
        throw new Error("The AI model is loading. Please wait a moment and try again.");
      }
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
