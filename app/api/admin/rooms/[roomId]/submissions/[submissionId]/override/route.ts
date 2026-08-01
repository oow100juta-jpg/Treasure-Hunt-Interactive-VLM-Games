import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { overrideSchema } from "@/lib/game/validation";
import { apiError, assertSameOrigin } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ roomId: string; submissionId: string }> }) {
  try {
    assertSameOrigin(request);
    const { roomId, submissionId } = await context.params;
    const { supabase, user } = await requireAdmin();
    const parsed = overrideSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const { data: submission, error: submissionError } = await supabase.from("submissions").select("detected_object,confidence,room_id").eq("id", submissionId).eq("room_id", roomId).single();
    if (submissionError || !submission) throw submissionError ?? new Error("Submission not found");
    const { data, error } = await supabase.rpc("process_submission_decision", { target_submission_id: submissionId, accepted: parsed.data.decision === "accepted", detected_object: submission.detected_object, reason: parsed.data.reason, confidence: submission.confidence, source: "admin", admin_id: user.id, override_reason: parsed.data.reason });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}
