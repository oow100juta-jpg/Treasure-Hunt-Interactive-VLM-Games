"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera as CameraIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraCapture, type CameraCaptureHandle } from "@/components/camera-capture";
import { ImagePreview } from "@/components/image-preview";
import { ValidationResult } from "@/components/validation-result";
import { TILE_MAP } from "@/lib/bingo-data";
import { compressImage } from "@/lib/image-utils";
import {
  getActiveTeam,
  getTeamSession,
  markTileCompleted,
  addFailedSubmission,
} from "@/lib/storage";
import type { ValidationResponse } from "@/types/bingo";

type FlowState = "detail" | "camera" | "preview" | "submitting" | "result";

export default function TileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tileId = params.tileId as string;
  const tile = TILE_MAP.get(tileId);

  const [flowState, setFlowState] = useState<FlowState>("detail");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidationResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const cameraRef = useRef<CameraCaptureHandle>(null);

  // Check if tile is already completed
  const teamName = typeof window !== "undefined" ? getActiveTeam() : null;
  const session =
    typeof window !== "undefined" && teamName
      ? getTeamSession(teamName)
      : null;
  const isCompleted = session?.completedTiles.includes(tileId) ?? false;

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      cameraRef.current?.stopCamera();
    };
  }, []);

  const handleCapture = useCallback((dataUrl: string) => {
    setCapturedImage(dataUrl);
    setFlowState("preview");
  }, []);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setValidationResult(null);
    setValidationError(null);
    setFlowState("camera");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!capturedImage || !tile || !teamName) return;

    if (!isOnline) {
      setValidationError(
        "You appear to be offline. Your progress is safe. Reconnect to submit this photo."
      );
      setFlowState("result");
      return;
    }

    setFlowState("submitting");
    setValidationResult(null);
    setValidationError(null);

    try {
      // Compress image
      const compressed = await compressImage(capturedImage, 1024, 0.8);

      const response = await fetch("/api/validate-object", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: compressed,
          targetLabel: tile.label,
          targetDescription: tile.description,
          acceptedTerms: tile.acceptedTerms,
        }),
      });

      if (response.status === 429) {
        setValidationError(
          "The AI service is currently busy. Please wait a moment and try again."
        );
        setFlowState("result");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            "The AI could not check your photo right now. Please try again."
        );
      }

      const result: ValidationResponse = await response.json();
      setValidationResult(result);

      if (result.correct) {
        markTileCompleted(teamName, tileId, {
          result: "correct",
          confidence: result.confidence,
          reason: result.reason,
          detectedObject: result.detectedObject,
        });
      } else {
        addFailedSubmission(teamName, tileId, {
          result: "incorrect",
          confidence: result.confidence,
          reason: result.reason,
          detectedObject: result.detectedObject,
        });
      }

      setFlowState("result");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The AI could not check your photo right now. Please try again.";
      setValidationError(message);
      setFlowState("result");
    }
  }, [capturedImage, tile, teamName, tileId, isOnline]);

  const handleContinue = useCallback(() => {
    router.push("/game");
  }, [router]);

  const handleBackToBingo = useCallback(() => {
    cameraRef.current?.stopCamera();
    router.push("/game");
  }, [router]);

  // Invalid tile
  if (!tile) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-violet-50/30">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Tile Not Found
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            This bingo tile does not exist.
          </p>
          <Button
            onClick={() => router.push("/game")}
            className="rounded-xl"
          >
            Back to Bingo
          </Button>
        </div>
      </div>
    );
  }

  // Already completed
  if (isCompleted) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-violet-50/30">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            Already Found!
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            You&apos;ve already found a {tile.label}.
          </p>
          <Button
            onClick={() => router.push("/game")}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white"
          >
            Back to Bingo
          </Button>
        </div>
      </div>
    );
  }

  // Camera view
  if (flowState === "camera") {
    return (
      <div className="fixed inset-0 z-40 bg-black">
        <CameraCapture
          ref={cameraRef}
          targetLabel={tile.label}
          onCapture={handleCapture}
          onCancel={handleBackToBingo}
        />
      </div>
    );
  }

  // Preview view
  if (flowState === "preview" || flowState === "submitting") {
    return (
      <div className="fixed inset-0 z-40 bg-black">
        <ImagePreview
          imageDataUrl={capturedImage!}
          targetLabel={tile.label}
          isSubmitting={flowState === "submitting"}
          onRetake={handleRetake}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  // Result view
  if (flowState === "result") {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-violet-50/30">
        <ValidationResult
          result={validationResult}
          error={validationError}
          targetLabel={tile.label}
          onTryAgain={handleRetake}
          onBackToBingo={handleBackToBingo}
          onContinue={handleContinue}
        />
      </div>
    );
  }

  // Detail view (initial)
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-violet-50/30">
      {/* Back button */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToBingo}
            className="rounded-xl -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col items-center text-center">
        {/* Object info */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-5 shadow-sm">
          <span className="text-4xl">🔍</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Find a {tile.label}
        </h2>
        <p className="text-gray-500 mb-2">{tile.description}</p>
        <p className="text-xs text-gray-400 mb-8 max-w-xs">
          Take a clear photo of the object. Make sure it&apos;s visible and
          well-lit. The AI will verify if it matches.
        </p>

        {/* Offline warning */}
        {!isOnline && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700">
            You appear to be offline. Reconnect to submit photos.
          </div>
        )}

        <Button
          onClick={() => setFlowState("camera")}
          disabled={!isOnline}
          className="w-full max-w-xs h-14 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold text-base shadow-lg shadow-purple-500/25 transition-all active:scale-[0.97]"
        >
          <CameraIcon className="w-5 h-5 mr-2" />
          Open Camera
        </Button>
      </div>
    </div>
  );
}
