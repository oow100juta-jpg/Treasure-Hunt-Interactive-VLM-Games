"use client";
/* eslint-disable @next/next/no-img-element -- signed/private and blob URLs are intentionally rendered without the image optimizer */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronRight, CircleAlert, LoaderCircle, MapPin, Radio, RotateCcw, Trophy, Wifi } from "lucide-react";
import { CameraCapture } from "@/components/camera-capture";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Countdown } from "./countdown";
import { NeoButton, NeoCard, StatusBadge } from "./neo";
import { WaitingIllustration } from "./illustrations";

type State = {
  serverNow: string; phase: "lobby" | "active_leaderboard_visible" | "active_leaderboard_frozen" | "ended";
  room: { id: string; code: string; name: string; endsAt: string | null; endingTitle: string; endingMessage: string; meetingLocation: string };
  team: { id: string; name: string; status: string; totalScore: number; completedClueCount: number; totalAttemptCount: number; freezeAcknowledged: boolean };
  joinedTeamCount: number;
  assignment: null | { id: string; status: string; attemptCount: number; sequenceNumber: number; clue: { text: string; difficulty: string; category: string } };
  submission: null | { id: string; evaluationStatus: string; decision: "accepted" | "rejected" | null; detectedObject: string | null; reason: string | null; confidence: number | null; attemptNumber: number; imageUrl: string | null };
  leaderboard: null | Array<{ id: string; name: string; totalScore: number; completedClueCount: number; totalAttemptCount: number; rank: number }>;
};

export function PlayClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryMode, setRetryMode] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/participant/state?roomCode=${encodeURIComponent(roomCode)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) { router.replace(`/?room=${encodeURIComponent(roomCode)}`); return; }
      if (!response.ok) throw new Error(data.error || "Could not load the game.");
      setState(data); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connection lost. Retrying…"); }
  }, [roomCode, router]);

  useEffect(() => { void refresh(); const interval = window.setInterval(refresh, 5000); return () => window.clearInterval(interval); }, [refresh]);
  useEffect(() => {
    if (!state?.room.id) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(`room:${state.room.id}`).on("broadcast", { event: "state_changed" }, () => void refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [state?.room.id, refresh]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function acceptCameraCapture(dataUrl: string) {
    try {
      const match = /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl);
      if (!match) throw new Error("The camera image could not be prepared. Please retake it.");
      const binary = window.atob(match[1]);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/jpeg" });
      if (blob.type !== "image/jpeg" || blob.size === 0 || blob.size > 4 * 1024 * 1024) {
        throw new Error("The camera image could not be prepared. Please retake it.");
      }
      const capturedFile = new File([blob], `camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      if (preview) URL.revokeObjectURL(preview);
      setFile(capturedFile);
      setPreview(URL.createObjectURL(capturedFile));
      setCameraOpen(false);
      setError("");
    } catch (cause) {
      setCameraOpen(false);
      setError(cause instanceof Error ? cause.message : "The camera image could not be prepared. Please retake it.");
    }
  }
  function openCamera() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setError("");
    setCameraOpen(true);
  }
  async function submit() {
    if (!file) return; setBusy(true); setError("");
    const form = new FormData(); form.set("image", file);
    try {
      const response = await fetch("/api/participant/submit", { method: "POST", headers: { "X-Capture-Source": "browser-camera" }, body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Submission failed.");
      setRetryMode(false); setCameraOpen(false); setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Submission failed."); await refresh(); }
    finally { setBusy(false); }
  }
  async function advance(mode?: "leaderboard") {
    setBusy(true); setError("");
    try { const response = await fetch("/api/participant/continue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not continue."); await refresh(); }
    finally { setBusy(false); }
  }
  async function acknowledge() { setBusy(true); await fetch("/api/participant/acknowledge-freeze", { method: "POST" }); await refresh(); setBusy(false); }

  if (!state) return <LoadingScreen error={error} />;
  if (state.phase === "ended") return <EndingScreen state={state} />;
  if (state.phase === "lobby") return <WaitingScreen state={state} error={error} />;
  if (state.phase === "active_leaderboard_frozen" && !state.team.freezeAcknowledged) return <FreezeScreen onContinue={acknowledge} busy={busy} />;
  const header = <GameHeader state={state} refresh={refresh} />;
  if (state.team.status === "viewing_leaderboard" && state.phase === "active_leaderboard_visible") return <>{header}<LeaderboardScreen state={state} onContinue={() => advance()} busy={busy} /></>;
  if (state.team.status === "accepted" && state.submission?.decision === "accepted") return <>{header}<ResultScreen state={state} accepted onAction={() => advance(state.phase === "active_leaderboard_visible" ? "leaderboard" : undefined)} busy={busy} /></>;
  if (state.team.status === "reviewing" || busy) return <>{header}<ReviewScreen state={state} preview={preview} /></>;
  if (!retryMode && (state.team.status === "rejected" || state.submission?.evaluationStatus === "failed")) return <>{header}<ResultScreen state={state} accepted={false} onAction={() => { setRetryMode(true); setFile(null); setPreview(null); }} busy={busy} /></>;
  if (state.team.status === "completed_all") return <>{header}<CompletedAllScreen /></>;
  return <>{header}<ClueScreen state={state} preview={preview} error={error} cameraOpen={cameraOpen} openCamera={openCamera} closeCamera={() => setCameraOpen(false)} acceptCameraCapture={acceptCameraCapture} submit={submit} busy={busy} /></>;
}

function GameHeader({ state, refresh }: { state: State; refresh: () => void }) {
  return <header className="sticky top-0 z-30 border-b-2 border-black bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-xl items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em]">{state.room.code}</p><p className="display text-lg leading-none">{state.team.name}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="text-[10px] font-bold uppercase text-zinc-500">Global timer</p><p className="display text-xl"><Countdown endsAt={state.room.endsAt} serverNow={state.serverNow} onEnd={refresh} /></p></div><Wifi size={18} className="text-emerald-600" /></div></div></header>;
}

function LoadingScreen({ error }: { error: string }) { return <main className="flex min-h-dvh flex-col justify-between bg-kcv-peach px-8 py-16"><div><h1 className="display text-5xl leading-[.96]">Search.<br />See.<br />Snap.</h1></div><div className="mx-auto w-full max-w-xs text-center"><WaitingIllustration className="w-full" /><p className="display mt-4 tracking-[.25em]">LOADING <span className="animate-pulse">•••</span></p><p className="mt-3 text-sm text-red-800">{error}</p></div><span /></main>; }
function WaitingScreen({ state, error }: { state: State; error: string }) { return <main className="participant-page"><div className="mx-auto w-full max-w-md"><div className="flex items-center justify-between"><StatusBadge tone="green"><Radio size={13} /> Connected</StatusBadge><span className="text-sm font-black">{state.joinedTeamCount} teams joined</span></div><WaitingIllustration className="mx-auto mt-10 w-full max-w-sm" /><div className="text-center"><p className="kicker">Room {state.room.code}</p><h1 className="display mt-3 text-5xl">Still waiting…</h1><p className="mt-3 text-zinc-600">Hey, <b>{state.team.name}</b>. {state.room.name} will begin when your host starts the shared clock.</p><div className="mx-auto mt-8 flex w-fit gap-2"><i className="loading-dot" /><i className="loading-dot" /><i className="loading-dot" /></div><p className="mt-5 text-sm text-red-700">{error}</p></div></div></main>; }
function FreezeScreen({ onContinue, busy }: { onContinue: () => void; busy: boolean }) { return <main className="participant-page justify-center"><div className="mx-auto max-w-md"><p className="kicker mb-5">A quick update</p><h1 className="display text-6xl leading-[.9]">The Leaderboard is Frozen</h1><NeoCard className="mt-9 bg-kcv-yellow p-6"><Trophy className="mb-5" size={34} /><p className="font-bold leading-relaxed">You can still complete more clues and earn points, but rankings will no longer be shown. The winner will be announced after the game ends.</p></NeoCard><NeoButton onClick={onContinue} disabled={busy} className="mt-10 w-full">Keep hunting <ChevronRight /></NeoButton></div></main>; }
function EndingScreen({ state }: { state: State }) { return <main className="participant-page justify-center"><div className="mx-auto max-w-md"><p className="kicker">Time’s up</p><h1 className="display mt-4 whitespace-pre-line text-6xl leading-[.9]">{state.room.endingTitle}</h1><p className="mt-8 text-lg leading-relaxed text-zinc-600">{state.room.endingMessage}</p>{state.room.meetingLocation && <NeoCard className="mt-8 bg-kcv-blue p-6 text-black"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><MapPin size={16} />Meeting point</p><p className="display mt-3 text-3xl">{state.room.meetingLocation}</p></NeoCard>}<div className="mt-12 flex gap-8 border-t-2 border-black pt-6"><div><b className="display text-3xl">{state.team.completedClueCount}</b><p className="text-xs uppercase">clues found</p></div><div><b className="display text-3xl">{state.team.totalScore}</b><p className="text-xs uppercase">total points</p></div></div></div></main>; }

function ClueScreen({ state, preview, error, cameraOpen, openCamera, closeCamera, acceptCameraCapture, submit, busy }: { state: State; preview: string | null; error: string; cameraOpen: boolean; openCamera: () => void; closeCamera: () => void; acceptCameraCapture: (dataUrl: string) => void; submit: () => void; busy: boolean }) {
  if (!state.assignment) return <CompletedAllScreen />;
  return (
    <main className="participant-page">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <p className="kicker">Clue {state.assignment.sequenceNumber}</p>
          <StatusBadge tone={state.assignment.clue.difficulty === "hard" ? "red" : state.assignment.clue.difficulty === "medium" ? "orange" : "green"}>{state.assignment.clue.difficulty}</StatusBadge>
        </div>
        <h1 className="display mt-5 text-5xl">The clue is…</h1>
        <NeoCard className="mt-7 p-6"><p className="display text-2xl leading-tight">{state.assignment.clue.text}</p></NeoCard>
        <div className="mt-9 overflow-hidden rounded-[2rem] border-2 border-black bg-zinc-100 aspect-[4/3]">
          {cameraOpen ? (
            <CameraCapture embedded targetLabel={state.assignment.clue.text} onCapture={acceptCameraCapture} onCancel={closeCamera} />
          ) : preview ? (
            <img src={preview} alt="Your camera capture" className="h-full w-full object-cover" />
          ) : (
            <button onClick={openCamera} className="flex h-full w-full flex-col items-center justify-center gap-3 text-zinc-500">
              <div className="rounded-full border-2 border-black bg-white p-5 text-black"><Camera size={30} /></div>
              <span className="text-sm font-bold">Open the live camera</span>
              <span className="text-xs">Camera capture only · max 4 MB</span>
            </button>
          )}
        </div>
        <p className="mt-4 min-h-5 text-sm font-semibold text-red-700" role="alert">{error}</p>
        {!cameraOpen && (preview ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={openCamera} className="secondary-button"><RotateCcw size={18} /> Retake</button>
            <NeoButton onClick={submit} disabled={busy}>Submit <ChevronRight /></NeoButton>
          </div>
        ) : (
          <NeoButton onClick={openCamera} className="mt-3 w-full"><Camera size={18} /> Open camera</NeoButton>
        ))}
        <div className="mt-8 flex justify-between border-t border-zinc-300 pt-4 text-xs font-bold text-zinc-500">
          <span>Attempt {state.assignment.attemptCount + 1}</span>
          <span>{state.team.completedClueCount} completed · {state.team.totalScore} pts</span>
        </div>
      </div>
    </main>
  );
}

function ReviewScreen({ state, preview }: { state: State; preview: string | null }) { const image = preview || state.submission?.imageUrl; return <main className="participant-page"><div className="mx-auto w-full max-w-md text-center"><p className="kicker">Attempt {state.submission?.attemptNumber ?? state.assignment?.attemptCount}</p><h1 className="display mt-4 text-5xl">AI is reviewing your submission</h1>{image && <div className="relative mt-8 overflow-hidden rounded-[2rem] border-2 border-black aspect-square"><img src={image} alt="Submitted object" className="h-full w-full object-cover opacity-70" /><div className="scan-line" /></div>}<div className="mt-8 flex items-center justify-center gap-3 font-bold"><LoaderCircle className="animate-spin" /> Looking for a semantic match…</div><p className="mt-3 text-sm text-zinc-500">Keep this page open. Duplicate submissions are disabled.</p></div></main>; }

function ResultScreen({ state, accepted, onAction, busy }: { state: State; accepted: boolean; onAction: () => void; busy: boolean }) { const submission = state.submission; return <main className="participant-page"><div className="mx-auto w-full max-w-md"><div className="text-center"><div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-black ${accepted ? "bg-kcv-green" : "bg-kcv-pink"}`}>{accepted ? <Check size={40} strokeWidth={3} /> : <CircleAlert size={38} />}</div><p className="kicker mt-6">{accepted ? "Clue completed" : "Not quite yet"}</p><h1 className="display mt-3 text-5xl">{accepted ? "That’s a match!" : "Give it another shot"}</h1></div>{submission?.imageUrl && <div className="mt-8 overflow-hidden rounded-[2rem] border-2 border-black aspect-[4/3]"><img src={submission.imageUrl} alt="Evaluated submission" className="h-full w-full object-cover" /></div>}<NeoCard className={`mt-6 p-6 ${accepted ? "bg-kcv-green" : "bg-kcv-pink"}`}><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt className="font-black">Detected</dt><dd>{submission?.detectedObject || "Unclear"}</dd><dt className="font-black">Reason</dt><dd>{submission?.reason || "The evaluator could not verify the object."}</dd><dt className="font-black">Confidence</dt><dd>{submission?.confidence == null ? "—" : `${Math.round(submission.confidence * 100)}%`}</dd><dt className="font-black">Attempt</dt><dd>{submission?.attemptNumber ?? "—"}</dd>{accepted && <><dt className="font-black">Total score</dt><dd>{state.team.totalScore} points</dd></>}</dl></NeoCard><NeoButton onClick={onAction} disabled={busy} className="mt-8 w-full">{accepted ? (state.phase === "active_leaderboard_visible" ? "See the leaderboard" : "Next clue") : "Try again"} <ChevronRight /></NeoButton></div></main>; }

function LeaderboardScreen({ state, onContinue, busy }: { state: State; onContinue: () => void; busy: boolean }) { const board = state.leaderboard ?? []; const own = board.find((row) => row.id === state.team.id); return <main className="participant-page"><div className="mx-auto w-full max-w-md"><p className="kicker">Live until the freeze</p><div className="mt-3 flex items-end justify-between"><h1 className="display text-5xl">Leaderboard</h1>{own && <StatusBadge tone="blue">You’re #{own.rank}</StatusBadge>}</div><div className="mt-8 space-y-3">{board.map((team) => <NeoCard key={team.id} className={`flex items-center gap-4 px-5 py-4 ${team.id === state.team.id ? "bg-kcv-yellow" : "bg-white"}`}><span className="display w-8 text-2xl">{team.rank}</span><div className="min-w-0 flex-1"><p className="truncate font-black">{team.name}</p><p className="text-xs text-zinc-500">{team.completedClueCount} clues · {team.totalAttemptCount} attempts</p></div><b className="display text-xl">{team.totalScore}</b></NeoCard>)}</div><NeoButton onClick={onContinue} disabled={busy} className="mt-9 w-full">Continue to next clue <ChevronRight /></NeoButton></div></main>; }
function CompletedAllScreen() { return <main className="participant-page justify-center"><div className="mx-auto max-w-md text-center"><span className="text-7xl">✦</span><h1 className="display mt-6 text-5xl">You found them all.</h1><p className="mt-4 text-zinc-600">No unused clues remain for your team. Your score is locked in; stay here until the global game ends.</p></div></main>; }
