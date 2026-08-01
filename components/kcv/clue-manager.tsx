"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Library, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { NeoButton, NeoCard, StatusBadge } from "./neo";

type Clue = {
  id: string;
  text: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  expected_objects: unknown;
};

type ClueData = { selected: Clue[]; available: Clue[] };

export function ClueManager({ roomId, roomStatus }: { roomId: string; roomStatus: string }) {
  const [data, setData] = useState<ClueData>({ selected: [], available: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [existingClueId, setExistingClueId] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/rooms/${roomId}/clues`, { cache: "no-store" });
    const json = await response.json();
    if (response.status === 401) {
      location.href = "/admin/login";
      return;
    }
    if (!response.ok) {
      setError(json.error || "Could not load clues.");
    } else {
      setData(json);
      setExistingClueId((current) => current && json.available.some((clue: Clue) => clue.id === current) ? current : json.available[0]?.id ?? "");
      setError("");
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => { void load(); }, [load]);

  async function createClue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy("new"); setError("");
    const response = await fetch(`/api/admin/rooms/${roomId}/clues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "new",
        text: values.get("text"),
        difficulty: values.get("difficulty"),
        category: values.get("category"),
        expectedObjects: String(values.get("expectedObjects") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      }),
    });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Could not add the clue.");
    else { form.reset(); await load(); }
    setBusy("");
  }

  async function addExisting() {
    if (!existingClueId) return;
    setBusy(existingClueId); setError("");
    const response = await fetch(`/api/admin/rooms/${roomId}/clues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "existing", clueId: existingClueId }),
    });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Could not add the clue.");
    else await load();
    setBusy("");
  }

  async function removeClue(clue: Clue) {
    const activeWarning = roomStatus === "active" ? " Teams already working on this clue will keep it; it will only be removed from future selections." : "";
    if (!confirm(`Remove this clue from the room?${activeWarning}\n\n${clue.text}`)) return;
    setBusy(clue.id); setError("");
    const response = await fetch(`/api/admin/rooms/${roomId}/clues`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clueId: clue.id }),
    });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Could not remove the clue.");
    else await load();
    setBusy("");
  }

  return (
    <NeoCard className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black p-5">
        <div>
          <p className="kicker">Room clue pool</p>
          <h2 className="display mt-1 text-2xl">Clue management</h2>
          <p className="mt-1 text-sm text-zinc-500">{loading ? "Loading…" : `${data.selected.length} clues available to this room`}</p>
        </div>
        <button className="secondary-button" onClick={() => setOpen((value) => !value)}>
          <Library size={17} /> {open ? "Close manager" : "Manage clues"}
        </button>
      </div>

      {open && <>
        <div className="grid gap-5 border-b border-zinc-300 bg-kcv-yellow/40 p-5 lg:grid-cols-2">
          <form onSubmit={createClue} className="space-y-3">
            <div><p className="font-black">Create a new clue</p><p className="text-xs text-zinc-500">The new clue is added only to this room.</p></div>
            <label className="block"><span className="field-label">Clue</span><textarea name="text" required minLength={5} maxLength={240} className="neo-input min-h-20" placeholder="Find something…" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="field-label">Difficulty</span><select name="difficulty" className="neo-input" defaultValue="easy"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
              <label><span className="field-label">Category</span><input name="category" required minLength={2} maxLength={60} className="neo-input" placeholder="Everyday" /></label>
            </div>
            <label className="block"><span className="field-label">Expected objects</span><input name="expectedObjects" className="neo-input" placeholder="broom, mop, vacuum" /><small className="mt-1 block text-zinc-500">Comma-separated hints for the vision evaluator.</small></label>
            <NeoButton type="submit" disabled={Boolean(busy)}>{busy === "new" ? <LoaderCircle className="animate-spin" /> : <Plus />}Add new clue</NeoButton>
          </form>

          <div className="space-y-3">
            <div><p className="font-black">Add an existing clue</p><p className="text-xs text-zinc-500">Reuse a clue already available in the shared library.</p></div>
            <select className="neo-input" value={existingClueId} onChange={(event) => setExistingClueId(event.target.value)} disabled={!data.available.length}>
              {!data.available.length && <option value="">No other clues available</option>}
              {data.available.map((clue) => <option key={clue.id} value={clue.id}>{clue.text} ({clue.difficulty})</option>)}
            </select>
            <NeoButton type="button" onClick={addExisting} disabled={!existingClueId || Boolean(busy)}>{busy === existingClueId ? <LoaderCircle className="animate-spin" /> : <Plus />}Add existing clue</NeoButton>
          </div>
        </div>

        <div className="divide-y divide-zinc-300">
          {data.selected.map((clue) => (
            <div key={clue.id} className="flex items-start justify-between gap-4 p-4 md:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={difficultyTone(clue.difficulty)}>{clue.difficulty}</StatusBadge><span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{clue.category}</span></div>
                <p className="mt-2 font-bold">{clue.text}</p>
                <p className="mt-1 text-xs text-zinc-500">Expected: {expectedObjects(clue.expected_objects) || "semantic match only"}</p>
              </div>
              <button className="danger-button shrink-0" onClick={() => void removeClue(clue)} disabled={busy === clue.id} aria-label={`Remove clue: ${clue.text}`}>
                {busy === clue.id ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}<span className="hidden sm:inline">Remove</span>
              </button>
            </div>
          ))}
          {!loading && !data.selected.length && <p className="p-8 text-center text-sm font-bold text-zinc-500">No clues are currently available to this room.</p>}
        </div>
      </>}
      <p className="px-5 py-3 text-sm font-bold text-red-700" role="alert">{error}</p>
    </NeoCard>
  );
}

function expectedObjects(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : "";
}

function difficultyTone(difficulty: Clue["difficulty"]): "green" | "orange" | "red" {
  return difficulty === "easy" ? "green" : difficulty === "medium" ? "orange" : "red";
}
