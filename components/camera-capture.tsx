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
import { Camera, X, SwitchCamera, Upload } from "lucide-react";

export interface CameraCaptureHandle {
  stopCamera: () => void;
}

interface CameraCaptureProps {
  targetLabel: string;
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export const CameraCapture = forwardRef<CameraCaptureHandle, CameraCaptureProps>(
  function CameraCapture({ targetLabel, onCapture, onCancel }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">(
      "environment"
    );
    const [cameraCount, setCameraCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      stopStream();
      onCapture(dataUrl);
    };

    const handleSwitchCamera = () => {
      setFacingMode((prev) =>
        prev === "environment" ? "user" : "environment"
      );
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onCapture(reader.result);
        }
      };
      reader.readAsDataURL(file);
    };

    const handleCancel = () => {
      stopStream();
      onCancel();
    };

    // Permission denied or no camera — show file upload fallback
    if (hasPermission === false) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Camera className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">
              Camera Not Available
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Camera access was denied or is not available. You can upload a
              photo from your gallery instead.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Photo
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
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 pb-8">
          <p className="text-white text-center text-sm font-medium">
            Find a <span className="font-bold text-amber-400">{targetLabel}</span>
          </p>
        </div>

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
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent pt-12 pb-8 px-4">
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
              aria-label="Take photo"
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
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

          {/* File upload fallback button */}
          <div className="mt-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-white/60 text-xs underline hover:text-white/80 transition-colors"
            >
              Or upload from gallery
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }
);
