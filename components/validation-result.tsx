"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, RotateCcw, ArrowLeft } from "lucide-react";
import type { ValidationResponse } from "@/types/bingo";

interface ValidationResultProps {
  result: ValidationResponse | null;
  error?: string | null;
  targetLabel: string;
  onTryAgain: () => void;
  onBackToBingo: () => void;
  onContinue: () => void;
}

export function ValidationResult({
  result,
  error,
  targetLabel,
  onTryAgain,
  onBackToBingo,
  onContinue,
}: ValidationResultProps) {
  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4 animate-in zoom-in duration-300">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Oops!</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">{error}</p>
        <div className="space-y-2 w-full max-w-xs">
          <Button
            onClick={onTryAgain}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button
            variant="ghost"
            onClick={onBackToBingo}
            className="w-full h-10 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Bingo
          </Button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // Success
  if (result.correct) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-300">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-1">
          Object Found! 🎉
        </h3>
        <p className="text-sm text-gray-500 mb-2">
          The AI confirmed that this is a{" "}
          <span className="font-bold text-emerald-600">
            {result.detectedObject || targetLabel}
          </span>
          .
        </p>
        {result.confidence > 0 && (
          <div className="mb-6">
            <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
              Confidence: {Math.round(result.confidence * 100)}%
            </span>
          </div>
        )}
        <Button
          onClick={onContinue}
          className="w-full max-w-xs h-12 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-white font-semibold shadow-lg shadow-emerald-500/25"
        >
          Continue
        </Button>
      </div>
    );
  }

  // Incorrect
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4 animate-in zoom-in duration-300">
        <XCircle className="w-8 h-8 text-amber-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Not Quite!</h3>
      <p className="text-sm text-gray-500 mb-2">
        The AI could not clearly find a{" "}
        <span className="font-semibold">{targetLabel}</span> in this image.
      </p>
      {result.reason && (
        <p className="text-xs text-gray-400 mb-6 max-w-xs italic">
          &ldquo;{result.reason}&rdquo;
        </p>
      )}
      <div className="space-y-2 w-full max-w-xs">
        <Button
          onClick={onTryAgain}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
        <Button
          variant="ghost"
          onClick={onBackToBingo}
          className="w-full h-10 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bingo
        </Button>
      </div>
    </div>
  );
}
