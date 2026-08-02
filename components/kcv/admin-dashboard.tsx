"use client";
/* eslint-disable @next/next/no-img-element -- private signed submission URLs should not pass through the public optimizer */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  Clock3,
  Eye,
  EyeOff,
  ImageOff,
  LoaderCircle,
  Lock,
  Play,
  Square,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Countdown } from "./countdown";
import { ClueManager } from "./clue-manager";
import { NeoButton, NeoCard, StatusBadge } from "./neo";

type Data = {
  serverNow: string;
  phase: string;
  room: {
    id: string;
    name: string;
    code: string;
    status: string;
    registration_open: boolean;
    game_duration_seconds: number;
    leaderboard_visible_seconds: number;
    clue_progression_strategy: string;
    ends_at: string | null;
    started_at: string | null;
    leaderboard_freezes_at: string | null;
    final_leaderboard_visible: boolean;
    meeting_location: string;
  };
  teams: Array<{
    id: string;
    name: string;
    status: string;
    online: boolean;
    currentClue: string | null;
    clueDifficulty: string | null;
    total_score: number;
    completed_clue_count: number;
    total_attempt_count: number;
    latestDecision: string | null;
    latestReason: string | null;
    last_seen_at: string;
    leaderboard_freeze_acknowledged_at: string | null;
  }>;
  leaderboard: Array<{
    id: string;
    name: string;
    rank: number;
    totalScore: number;
    completedClueCount: number;
    totalAttemptCount: number;
    acceptedFirstTryCount: number;
    status?: string;
  }>;
  submissions: Array<{
    id: string;
    team_id: string;
    evaluation_status: string;
    final_decision: string | null;
    ai_decision: string | null;
    decision_source: string | null;
    detected_object: string | null;
    evaluation_reason: string | null;
    confidence: number | null;
    attempt_number: number;
    submitted_at: string;
    imageUrl: string | null;
    teams?: { name: string };
    clue_assignments?: { clues?: { text: string } };
  }>;
};

export function AdminDashboard({ roomId }: { roomId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("all");
  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/rooms/${roomId}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (res.status === 401) {
      location.href = "/admin/login";
      return;
    }
    if (res.ok) {
      setData(json);
      setError("");
    } else setError(json.error);
  }, [roomId]);
  useEffect(() => {
    void load();
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`admin-room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${roomId}`,
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `room_id=eq.${roomId}`,
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `room_id=eq.${roomId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, load]);
  const filtered = useMemo(
    () =>
      data?.teams.filter(
        (t) =>
          filter === "all" ||
          (filter === "online" && t.online) ||
          (filter === "review" &&
            (t.status === "reviewing" || t.latestDecision === null)) ||
          t.status === filter,
      ) ?? [],
    [data, filter],
  );
  async function control(action: string) {
    if (!data) return;
    if (
      action === "start" &&
      !confirm(
        `Start ${data.room.name} for ${data.teams.length} teams?\n\nDuration: ${data.room.game_duration_seconds / 60} minutes\nLeaderboard freezes after: ${data.room.leaderboard_visible_seconds / 60} minutes\nStrategy: ${data.room.clue_progression_strategy}\nMeet at: ${data.room.meeting_location || "Not set"}`,
      )
    )
      return;
    if (
      action === "end" &&
      !confirm("End this game for every team now? This cannot be resumed.")
    )
      return;
    setBusy(action);
    const res = await fetch(`/api/admin/rooms/${roomId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error);
    await load();
    setBusy("");
  }
  async function override(
    submissionId: string,
    decision: "accepted" | "rejected",
  ) {
    const reason = prompt(
      `Reason for manually marking this submission ${decision}?`,
    );
    if (!reason) return;
    setBusy(submissionId);
    const res = await fetch(
      `/api/admin/rooms/${roomId}/submissions/${submissionId}/override`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      },
    );
    const json = await res.json();
    if (!res.ok) setError(json.error);
    await load();
    setBusy("");
  }
  if (!data)
    return (
      <main className="participant-page justify-center text-center">
        <LoaderCircle className="mx-auto animate-spin" />
        <p className="mt-4 font-bold">Loading mission control…</p>
        <p className="text-red-700">{error}</p>
      </main>
    );
  const totalCompleted = data.teams.reduce(
    (sum, t) => sum + t.completed_clue_count,
    0,
  );
  const online = data.teams.filter((t) => t.online).length;
  return (
    <main className="min-h-dvh bg-zinc-100 p-4 md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="mb-4 inline-flex items-center gap-1 text-sm font-bold"
            >
              <ChevronLeft size={16} />
              All rooms
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="display text-4xl md:text-5xl">{data.room.name}</h1>
              <StatusBadge
                tone={
                  data.phase.includes("active")
                    ? "green"
                    : data.phase === "ended"
                      ? "red"
                      : "orange"
                }
              >
                {data.phase.replaceAll("_", " ")}
              </StatusBadge>
            </div>
            <p className="mt-1 font-mono text-sm tracking-[.2em]">
              {data.room.code}
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-full border-2 border-black bg-white px-5 py-3 shadow-[3px_3px_0_#111]">
            <span className="text-xs font-black uppercase">Global time</span>
            <b className="display text-2xl">
              <Countdown
                endsAt={data.room.ends_at}
                serverNow={data.serverNow}
                onEnd={load}
              />
            </b>
          </div>
        </header>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Users />} label="Teams" value={data.teams.length} />
          <Metric icon={<Wifi />} label="Online now" value={online} />
          <Metric
            icon={<Eye />}
            label="Submissions"
            value={data.submissions.length}
          />
          <Metric
            icon={<Check />}
            label="Clues completed"
            value={totalCompleted}
          />
        </section>
        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <NeoCard className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="kicker">Game controls</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Trusted transitions use database time and are idempotent.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.room.status === "lobby" && (
                    <>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          control(
                            data.room.registration_open
                              ? "close_registration"
                              : "open_registration",
                          )
                        }
                      >
                        {data.room.registration_open ? (
                          <>
                            <Lock size={16} />
                            Close registration
                          </>
                        ) : (
                          <>
                            <Play size={16} />
                            Reopen registration
                          </>
                        )}
                      </button>
                      <NeoButton
                        onClick={() => control("start")}
                        disabled={Boolean(busy) || !data.teams.length}
                      >
                        {busy === "start" ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Play />
                        )}
                        Start game
                      </NeoButton>
                    </>
                  )}
                  {data.room.status === "active" && (
                    <button
                      className="danger-button"
                      onClick={() => control("end")}
                      disabled={Boolean(busy)}
                    >
                      <Square size={15} />
                      End early
                    </button>
                  )}
                  {/* {data.room.status === "ended" && (
                    <button
                      className="secondary-button"
                      onClick={() =>
                        control(
                          data.room.final_leaderboard_visible
                            ? "hide_final"
                            : "reveal_final",
                        ) 
                      }
                    >
                      {data.room.final_leaderboard_visible ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}{" "}
                      {data.room.final_leaderboard_visible
                        ? "Hide final board"
                        : "Reveal final board"}
                    </button>
                  )} */}
                </div>
              </div>
            </NeoCard>
            <NeoCard className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black p-5">
                <div>
                  <p className="kicker">Live team progress</p>
                  <h2 className="display mt-1 text-2xl">
                    Every team, one glance
                  </h2>
                </div>
                <select
                  className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-bold"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All states</option>
                  <option value="online">Online</option>
                  <option value="review">Needs review</option>
                  <option value="waiting">Waiting</option>
                  <option value="searching">Searching</option>
                  <option value="rejected">Rejected</option>
                  <option value="accepted">Accepted</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>State</th>
                      <th>Current clue</th>
                      <th>Completed</th>
                      <th>Attempts</th>
                      <th>Score</th>
                      <th>Latest AI</th>
                      <th>Freeze seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((team) => (
                      <tr key={team.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <i
                              className={`h-2.5 w-2.5 rounded-full ${team.online ? "bg-emerald-500" : "bg-zinc-300"}`}
                            />
                            <b>{team.name}</b>
                          </div>
                        </td>
                        <td>
                          <StatusBadge>{team.status}</StatusBadge>
                        </td>
                        <td className="max-w-60">
                          <p className="line-clamp-2">
                            {team.currentClue || "—"}
                          </p>
                          {team.clueDifficulty && (
                            <small>{team.clueDifficulty}</small>
                          )}
                        </td>
                        <td>{team.completed_clue_count}</td>
                        <td>{team.total_attempt_count}</td>
                        <td>
                          <b>{team.total_score}</b>
                        </td>
                        <td>
                          <span
                            className={
                              team.latestDecision === "accepted"
                                ? "text-emerald-700"
                                : team.latestDecision === "rejected"
                                  ? "text-red-700"
                                  : ""
                            }
                          >
                            {team.latestDecision || "—"}
                          </span>
                          <p className="line-clamp-1 max-w-48 text-xs text-zinc-500">
                            {team.latestReason}
                          </p>
                        </td>
                        <td>
                          {team.leaderboard_freeze_acknowledged_at
                            ? "Yes"
                            : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </NeoCard>
            <ClueManager roomId={roomId} roomStatus={data.room.status} />
            <NeoCard className="overflow-hidden">
              <div className="border-b-2 border-black p-5">
                <p className="kicker">Latest submissions</p>
                <h2 className="display mt-1 text-2xl">
                  AI decisions & manual review
                </h2>
              </div>
              <div className="divide-y divide-zinc-300">
                {data.submissions.map((sub) => (
                  <article
                    key={sub.id}
                    className="grid grid-cols-[96px_1fr] gap-4 p-4 md:grid-cols-[144px_1fr] md:p-5"
                  >
                    {sub.imageUrl ? (
                      <a
                        href={sub.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-black bg-zinc-100"
                        title="Open full-size submission"
                      >
                        <img
                          src={sub.imageUrl}
                          alt={`Submission from ${sub.teams?.name || "team"}`}
                          className="aspect-square h-full w-full object-cover"
                        />
                      </a>
                    ) : (
                      <div className="flex aspect-square items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-100 p-2 text-center text-xs font-bold text-zinc-500">
                        <ImageOff size={18} />
                        <span>Image unavailable</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap justify-between gap-2">
                        <b className="truncate">{sub.teams?.name || "Team"}</b>
                        <StatusBadge
                          tone={
                            sub.final_decision === "accepted"
                              ? "green"
                              : sub.final_decision === "rejected"
                                ? "red"
                                : "orange"
                          }
                        >
                          {sub.final_decision || sub.evaluation_status}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                        <Clock3 size={13} />
                        <time dateTime={sub.submitted_at}>
                          {formatSubmissionTimestamp(sub.submitted_at)}
                        </time>
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {sub.clue_assignments?.clues?.text}
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">
                        {sub.evaluation_reason}
                      </p>
                      <div className="mt-4 flex gap-2">
                        <button
                          className="mini-action bg-kcv-green"
                          onClick={() => override(sub.id, "accepted")}
                          disabled={busy === sub.id}
                        >
                          <Check size={13} />
                          Accept
                        </button>
                        <button
                          className="mini-action bg-kcv-pink"
                          onClick={() => override(sub.id, "rejected")}
                          disabled={busy === sub.id}
                        >
                          <X size={13} />
                          Reject
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </NeoCard>
          </div>
          <aside>
            <NeoCard className="sticky top-5 overflow-hidden">
              <div className="bg-black p-5 text-white">
                <p className="kicker text-zinc-400">Private all-game view</p>
                <h2 className="display mt-1 text-3xl">Leaderboard</h2>
              </div>
              <div className="space-y-0">
                {data.leaderboard.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 border-b border-zinc-300 p-4 last:border-0"
                  >
                    <span className="display w-7 text-xl">{team.rank}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate">{team.name}</b>
                      <small className="text-zinc-500">
                        {team.completedClueCount} clues ·{" "}
                        {team.totalAttemptCount} tries
                      </small>
                    </div>
                    <b className="display text-lg">{team.totalScore}</b>
                  </div>
                ))}
              </div>
            </NeoCard>
          </aside>
        </section>
        <p className="mt-4 text-sm font-bold text-red-700">{error}</p>
      </div>
    </main>
  );
}
function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <NeoCard className="flex items-center gap-4 p-5">
      <span className="rounded-full border-2 border-black bg-kcv-yellow p-3">
        {icon}
      </span>
      <div>
        <b className="display text-3xl">{value}</b>
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
      </div>
    </NeoCard>
  );
}

const submissionTimestamp = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Jakarta",
});

function formatSubmissionTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : `${submissionTimestamp.format(date)} WIB`;
}
