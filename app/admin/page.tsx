import { redirect } from "next/navigation";
import { RoomManager } from "@/components/kcv/room-manager";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  if (!hasSupabaseConfig()) return <main className="participant-page justify-center"><div className="mx-auto max-w-xl"><p className="kicker">Setup required</p><h1 className="display mt-4 text-5xl">Connect Supabase first.</h1><p className="mt-5 text-zinc-600">Copy <code>.env.example</code> to <code>.env.local</code>, add your project credentials, then apply the migration and seed.</p></div></main>;
  const supabase=await createSupabaseServerClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/admin/login");
  return <main className="min-h-dvh bg-zinc-100 px-5 py-10 md:px-10"><div className="mx-auto max-w-7xl"><RoomManager/></div></main>;
}
