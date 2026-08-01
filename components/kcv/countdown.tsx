"use client";
import { useEffect, useState } from "react";

export function Countdown({ endsAt, serverNow, onEnd }: { endsAt: string | null; serverNow: string; onEnd?: () => void }) {
  const initialRemaining = Math.max(0, (endsAt ? new Date(endsAt).getTime() : new Date(serverNow).getTime()) - new Date(serverNow).getTime());
  const [remaining, setRemaining] = useState(initialRemaining);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemaining((current) => { const next = Math.max(0, current - 1000); if (next <= 0) onEnd?.(); return next; });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt, serverNow, onEnd]);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return <span className="tabular-nums" aria-label={`${minutes} minutes ${seconds} seconds remaining`}>{minutes}:{seconds}</span>;
}
