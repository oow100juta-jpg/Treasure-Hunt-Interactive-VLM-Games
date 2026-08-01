import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/game/session";
import { getVisionProvider } from "@/lib/vision/providers";
import { apiError, assertSameOrigin } from "@/lib/http";
import { hasValidImageSignature } from "@/lib/security/image";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 4 * 1024 * 1024;
const maxRequestBytes = Math.floor(4.4 * 1024 * 1024);

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    assertSameOrigin(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
      return NextResponse.json({ error: "Images must be 4 MB or smaller." }, { status: 413 });
    }
    const { supabase, team, room } = await requireParticipant();
    await enforceRateLimit(supabase, {
      scope: "participant-submit",
      subject: team.id,
      limit: 6,
      windowSeconds: 60,
    });
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a photo to submit." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
    if (file.size > maxBytes) return NextResponse.json({ error: "Images must be 4 MB or smaller." }, { status: 413 });
    const imageBytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(imageBytes.subarray(0, 16), file.type)) {
      return NextResponse.json({ error: "The uploaded file is not a valid JPEG, PNG, or WebP image." }, { status: 415 });
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    uploadedPath = `${room.id}/${team.id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("participant-submissions").upload(uploadedPath, imageBytes, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data: beginData, error: beginError } = await supabase.rpc("begin_submission", { target_team_id: team.id, target_image_path: uploadedPath });
    if (beginError) {
      await supabase.storage.from("participant-submissions").remove([uploadedPath]);
      uploadedPath = null;
      return NextResponse.json({ error: beginError.message }, { status: 409 });
    }
    const begun = beginData as { submission_id: string; assignment_id: string; clue_id: string; attempt_number: number };
    const { data: clue, error: clueError } = await supabase.from("clues").select("text,expected_objects").eq("id", begun.clue_id).single();
    if (clueError || !clue) throw clueError ?? new Error("Assigned clue not found.");
    const { data: signed, error: signError } = await supabase.storage.from("participant-submissions").createSignedUrl(uploadedPath, 120);
    if (signError || !signed) throw signError ?? new Error("Could not prepare the private image for evaluation.");

    try {
      const evaluation = await getVisionProvider().evaluateSubmission({ clue: clue.text, expectedObjects: Array.isArray(clue.expected_objects) ? clue.expected_objects.filter((item): item is string => typeof item === "string") : [], imageUrl: signed.signedUrl });
      const { data: decision, error: decisionError } = await supabase.rpc("process_submission_decision", { target_submission_id: begun.submission_id, accepted: evaluation.accepted, detected_object: evaluation.detectedObject, reason: evaluation.reason, confidence: evaluation.confidence ?? null, source: "ai", admin_id: null, override_reason: null });
      if (decisionError) throw decisionError;
      return NextResponse.json({ submissionId: begun.submission_id, ...evaluation, decision });
    } catch (evaluationError) {
      console.error("[vision evaluation]", evaluationError);
      const failureReason = "The vision provider could not complete this evaluation.";
      await supabase.from("submissions").update({ evaluation_status: "failed", evaluation_reason: failureReason, evaluated_at: new Date().toISOString() }).eq("id", begun.submission_id);
      await supabase.from("clue_assignments").update({ status: "rejected" }).eq("id", begun.assignment_id).eq("status", "reviewing");
      await supabase.from("teams").update({ status: "rejected" }).eq("id", team.id);
      return NextResponse.json({ error: "The AI could not review this photo. You can retry, and an admin can still inspect the failed submission." }, { status: 502 });
    }
  } catch (error) {
    return apiError(error);
  }
}
