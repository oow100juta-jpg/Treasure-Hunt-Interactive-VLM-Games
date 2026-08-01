import { z } from "zod";

export const visionEvaluationSchema = z.object({
  accepted: z.boolean(),
  detectedObject: z.string().nullable(),
  reason: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1).optional(),
});

export type VisionEvaluation = z.infer<typeof visionEvaluationSchema>;
export interface VisionEvaluationProvider {
  evaluateSubmission(input: { clue: string; expectedObjects?: string[]; imageUrl: string }): Promise<VisionEvaluation>;
}
