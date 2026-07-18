"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { RotateCcw, Send, Loader2 } from "lucide-react";

interface ImagePreviewProps {
  imageDataUrl: string;
  targetLabel: string;
  isSubmitting: boolean;
  onRetake: () => void;
  onSubmit: () => void;
}

export function ImagePreview({
  imageDataUrl,
  targetLabel,
  isSubmitting,
  onRetake,
  onSubmit,
}: ImagePreviewProps) {
  return (
    <div className="flex flex-col h-full bg-black">
      {/* Target label */}
      <div className="bg-gradient-to-b from-black/70 to-transparent p-4 pb-6 text-center z-10">
        <p className="text-white text-sm font-medium">
          Looking for: <span className="font-bold text-amber-400">{targetLabel}</span>
        </p>
      </div>

      {/* Image */}
      <div className="flex-1 relative min-h-0">
        <Image
          src={imageDataUrl}
          alt="Captured photo"
          fill
          className="object-contain"
          unoptimized
        />
      </div>

      {/* Actions */}
      <div className="bg-gradient-to-t from-black/90 to-transparent pt-8 pb-8 px-6 z-10">
        <div className="max-w-sm mx-auto space-y-3">
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full h-13 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold text-base shadow-lg shadow-purple-500/30"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                AI is checking...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Submit to AI
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={onRetake}
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake
          </Button>
        </div>
      </div>
    </div>
  );
}
