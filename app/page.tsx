"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TeamLoginForm } from "@/components/team-login-form";
import { getActiveTeam, getTeamSession } from "@/lib/storage";

export default function LoginPage() {
  const router = useRouter();

  // Auto-redirect if team is already active
  useEffect(() => {
    const team = getActiveTeam();
    if (team && getTeamSession(team)) {
      router.replace("/game");
    }
  }, [router]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-gradient-to-br from-violet-200/40 to-purple-300/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-gradient-to-tr from-amber-200/30 to-yellow-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-gradient-to-br from-blue-200/20 to-indigo-200/20 rounded-full blur-2xl" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <TeamLoginForm />
      </div>
    </main>
  );
}
