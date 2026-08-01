"use client";
import { useEffect, useRef, useState } from "react";

export function Countdown({ endsAt, serverNow, onEnd }: { endsAt: string | null; serverNow: string; onEnd?: () => void }) {
  const [remaining, setRemaining] = useState(() => getRemaining(endsAt, serverNow));
  const notifiedEndRef = useRef<string | null>(null);

  useEffect(() => {
    const syncedRemaining = getRemaining(endsAt, serverNow);
    const localDeadline = Date.now() + syncedRemaining;
    const update = () => {
      const next = Math.max(0, localDeadline - Date.now());
      setRemaining(next);
      if (endsAt && next === 0 && notifiedEndRef.current !== endsAt) {
        notifiedEndRef.current = endsAt;
        onEnd?.();
      }
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt, serverNow, onEnd]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return <span className="tabular-nums" aria-label={`${minutes} minutes ${seconds} seconds remaining`}>{minutes}:{seconds}</span>;
}

function getRemaining(endsAt: string | null, serverNow: string) {
  if (!endsAt) return 0;
  const endTime = new Date(endsAt).getTime();
  const serverTime = new Date(serverNow).getTime();
  if (!Number.isFinite(endTime) || !Number.isFinite(serverTime)) return 0;
  return Math.max(0, endTime - serverTime);
}
