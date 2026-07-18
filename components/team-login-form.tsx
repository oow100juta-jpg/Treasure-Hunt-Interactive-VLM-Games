"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, Sparkles } from "lucide-react";
import { setActiveTeam, getTeamSession, createTeamSession } from "@/lib/storage";

export function TeamLoginForm() {
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const name = teamName.trim();
    if (!name) {
      setError("Please enter a team name.");
      return;
    }
    if (name.length > 30) {
      setError("Team name must be 30 characters or less.");
      return;
    }

    setIsLoading(true);

    // Save team and ensure session exists
    setActiveTeam(name);
    if (!getTeamSession(name)) {
      createTeamSession(name);
    }

    router.push("/game");
  };

  return (
    <Card className="w-full max-w-sm border-0 bg-white/80 backdrop-blur-xl shadow-2xl shadow-purple-500/10">
      <CardContent className="pt-8 pb-8 px-6">
        {/* Logo / Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Compass className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 text-center">
            AI Bingo Treasure Hunter
          </h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Find real objects. Snap a photo. Let AI verify.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name" className="text-sm font-medium text-gray-700">
              Team Name
            </Label>
            <Input
              id="team-name"
              type="text"
              placeholder="e.g., Vision Hunters"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setError("");
              }}
              maxLength={30}
              className="h-12 text-base rounded-xl border-gray-200 focus:border-violet-400 focus:ring-violet-400"
              autoFocus
              autoComplete="off"
            />
            {error && (
              <p className="text-sm text-red-500 font-medium" role="alert">
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:shadow-purple-500/40 active:scale-[0.98]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              "Start Hunting 🎯"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
