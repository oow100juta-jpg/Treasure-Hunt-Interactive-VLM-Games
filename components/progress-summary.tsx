"use client";

import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

interface ProgressSummaryProps {
  completedCount: number;
  totalCount: number;
  hasBingo: boolean;
}

export function ProgressSummary({
  completedCount,
  totalCount,
  hasBingo,
}: ProgressSummaryProps) {
  const percentage = Math.round((completedCount / totalCount) * 100);

  const statusMessage = hasBingo
    ? "🎉 BINGO! You completed a line!"
    : completedCount === 0
      ? "Find the objects and complete a line!"
      : completedCount < totalCount
        ? `${completedCount} of ${totalCount} objects discovered`
        : "All objects found! Amazing!";

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
          <Target className="w-4 h-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{statusMessage}</p>
          <p className="text-xs text-gray-500">
            {completedCount} / {totalCount} Found
          </p>
        </div>
      </div>

      <div className="relative">
        <Progress
          value={percentage}
          className="h-2.5 bg-gray-100 rounded-full"
        />
        {/* Shimmer overlay on the filled part */}
        <div
          className="absolute top-0 left-0 h-2.5 rounded-full overflow-hidden transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        >
          <div className="w-full h-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 bg-[length:200%_100%] animate-shimmer rounded-full" />
        </div>
      </div>
    </div>
  );
}
