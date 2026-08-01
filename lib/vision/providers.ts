import "server-only";
import OpenAI from "openai";
import { visionEvaluationSchema, type VisionEvaluationProvider } from "./types";

const prompt = (clue: string, expectedObjects: string[] = []) => `You are evaluating an image submitted for a semantic scavenger hunt.

Assigned clue: ${clue}
Possible examples (not exhaustive): ${expectedObjects.join(", ") || "none supplied"}

Determine whether visible content reasonably satisfies the clue. Use semantic reasoning; an exact predefined object is not required. Reject if no relevant object is clearly visible, the image is too dark/blurred/obstructed, the conclusion depends on invisible information, or the image is unrelated.

Return valid JSON only: {"accepted":boolean,"detectedObject":string|null,"reason":string,"confidence":number}`;

export class MockVisionEvaluationProvider implements VisionEvaluationProvider {
  async evaluateSubmission(input: { clue: string; expectedObjects?: string[]; imageUrl: string }) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const forcedReject = input.imageUrl.includes("mock-reject");
    return {
      accepted: !forcedReject,
      detectedObject: input.expectedObjects?.[0] ?? "matching object",
      reason: forcedReject ? "The submitted image does not clearly show an object matching the clue." : "The visible object reasonably satisfies the clue.",
      confidence: forcedReject ? 0.32 : 0.91,
    };
  }
}

export class OpenAICompatibleVisionProvider implements VisionEvaluationProvider {
  private client: OpenAI;
  constructor(baseURL = process.env.VISION_API_URL || undefined) {
    const apiKey = process.env.VISION_API_KEY;
    if (!apiKey) throw new Error("VISION_API_KEY is missing.");
    if (baseURL) {
      const url = new URL(baseURL);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("VISION_API_URL must be an HTTPS URL without embedded credentials.");
      }
    }
    this.client = new OpenAI({ apiKey, baseURL });
  }
  async evaluateSubmission(input: { clue: string; expectedObjects?: string[]; imageUrl: string }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await this.client.chat.completions.create({
        model: process.env.VISION_MODEL || "gpt-4.1-mini",
        temperature: 0,
        max_tokens: 250,
        messages: [{ role: "user", content: [{ type: "text", text: prompt(input.clue, input.expectedObjects) }, { type: "image_url", image_url: { url: input.imageUrl } }] }],
      }, { signal: controller.signal });
      const raw = response.choices[0]?.message.content ?? "";
      const match = raw.replace(/^```json\s*|\s*```$/g, "").match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Vision provider returned invalid JSON.");
      return visionEvaluationSchema.parse(JSON.parse(match[0]));
    } finally {
      clearTimeout(timer);
    }
  }
}

export class HuggingFaceVisionProvider extends OpenAICompatibleVisionProvider {
  constructor() {
    const baseURL = process.env.VISION_API_URL;
    if (!baseURL) throw new Error("VISION_API_URL is required for the Hugging Face provider.");
    const url = new URL(baseURL);
    if (url.protocol !== "https:" || url.hostname !== "router.huggingface.co") {
      throw new Error("The Hugging Face provider must use https://router.huggingface.co/v1.");
    }
    super(baseURL);
  }
}

export function getVisionProvider(): VisionEvaluationProvider {
  switch ((process.env.VISION_PROVIDER || "mock").toLowerCase()) {
    case "mock":
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_VISION_IN_PRODUCTION !== "true") {
        throw new Error("Mock vision is disabled in production.");
      }
      return new MockVisionEvaluationProvider();
    case "openai":
      return new OpenAICompatibleVisionProvider();
    case "huggingface":
      return new HuggingFaceVisionProvider();
    default:
      throw new Error("VISION_PROVIDER must be mock, openai, or huggingface.");
  }
}
