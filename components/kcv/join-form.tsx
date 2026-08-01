"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { NeoButton, NeoCard } from "./neo";

export function JoinForm() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/participant/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamName, roomCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not join this room.");
      router.push(`/play/${encodeURIComponent(data.roomCode)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not join this room."); setLoading(false); }
  }
  return (
    <NeoCard className="w-full p-5 sm:p-7">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="kicker">Ready to hunt?</p><h2 className="display text-3xl">Join a room</h2></div>
        <span className="rounded-full bg-kcv-yellow px-3 py-1 text-xs font-black">LIVE GAME</span>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="mb-2 block text-sm font-bold">Team name</span><input className="neo-input" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="team name" autoComplete="off" maxLength={40} required /></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">Room code</span><input className="neo-input uppercase tracking-[.22em]" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="room code" autoComplete="off" maxLength={12} required /></label>
        <p className="min-h-5 text-sm font-semibold text-red-700" role="alert">{error}</p>
        <NeoButton className="w-full" disabled={loading}>{loading ? <><LoaderCircle className="animate-spin" /> Joining…</> : <>Join the hunt <ArrowRight /></>}</NeoButton>
      </form>
    </NeoCard>
  );
}
