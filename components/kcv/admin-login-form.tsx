"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { NeoButton } from "./neo";

export function AdminLoginForm() {
  const router = useRouter(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Supabase is not configured. Add the public URL and anon key."); setBusy(false); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setBusy(false); return; }
    router.replace("/admin"); router.refresh();
  }
  return <form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-2 block text-sm font-bold">Email</span><input className="neo-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label><label className="block"><span className="mb-2 block text-sm font-bold">Password</span><input className="neo-input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label><p className="min-h-5 text-sm font-semibold text-red-700">{error}</p><NeoButton className="w-full" disabled={busy}>{busy?<LoaderCircle className="animate-spin"/>:<LogIn/>}{busy?"Signing in…":"Sign in"}</NeoButton></form>;
}
