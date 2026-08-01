"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera } from "lucide-react";

export interface CameraCaptureHandle {
  stopCamera: () => void;
}

interface CameraCaptureProps {
  targetLabel: string;
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
  embedded?: boolean;
}

export const CameraCapture = forwardRef<CameraCaptureHandle, CameraCaptureProps>(
  function CameraCapture({ targetLabel, onCapture, onCancel, embedded = false }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">(
      "environment"
    );
    const [cameraCount, setCameraCount] = useState(0);

    const stopStream = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }, []);

    useImperativeHandle(ref, () => ({ stopCamera: stopStream }));

    const startCamera = useCallback(
      async (facing: "environment" | "user") => {
        stopStream();
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing } },
            audio: false,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setHasPermission(true);

          // Count cameras
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter((d) => d.kind === "videoinput");
          setCameraCount(cameras.length);
        } catch {
          setHasPermission(false);
        }
      },
      [stopStream]
    );

    useEffect(() => {
      startCamera(facingMode);
      return () => stopStream();
    }, [facingMode, startCamera, stopStream]);

    const handleCapture = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (!video.videoWidth || !video.videoHeight) return;
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      stopStream();
      onCapture(dataUrl);
    };

    const handleSwitchCamera = () => {
      setFacingMode((prev) =>
        prev === "environment" ? "user" : "environment"
      );
    };

    const handleCancel = () => {
      stopStream();
      onCancel();
    };

    // Permission denied or no camera — do not fall back to gallery uploads.
    if (hasPermission === false) {
      return (
        <div className="flex h-full flex-col items-center justify-center space-y-3 bg-white p-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Camera className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">
              Camera Not Available
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Camera access was denied or is not available. Enable camera
              permission for this site and try again.
            </p>
          </div>
          <Button
            onClick={() => void startCamera(facingMode)}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white"
          >
            <Camera className="w-4 h-4 mr-2" />
            Try Camera Again
          </Button>
          <Button variant="ghost" onClick={handleCancel} className="rounded-xl">
            Cancel
          </Button>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full flex flex-col bg-black">
        {/* Target label overlay */}
        {!embedded && <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 pb-8">
          <p className="text-white text-center text-sm font-medium">
            Capture this clue: <span className="font-bold text-amber-400">{targetLabel}</span>
          </p>
        </div>}

        {/* Video Preview */}
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {hasPermission === null && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">Starting camera...</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className={`absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 ${embedded ? "pb-3 pt-8" : "pb-8 pt-12"}`}>
          <div className="flex items-center justify-between max-w-sm mx-auto">
            {/* Cancel */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              aria-label="Cancel"
              className="h-12 w-12 rounded-full text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>

            {/* Shutter */}
            <button
              onClick={handleCapture}
              disabled={hasPermission !== true}
              aria-label="Take photo"
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
            >
              <div className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 transition-colors" />
            </button>

            {/* Switch Camera */}
            {cameraCount > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwitchCamera}
                aria-label="Switch camera"
                className="h-12 w-12 rounded-full text-white hover:bg-white/20"
              >
                <SwitchCamera className="w-6 h-6" />
              </Button>
            ) : (
              <div className="w-12" /> // Spacer
            )}
          </div>

          {!embedded && <p className="mt-4 text-center text-xs text-white/60">Live camera capture only</p>}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }
);
