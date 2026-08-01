import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function NeoCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const hasBackgroundClass = className?.split(/\s+/).some((name) => name.startsWith("bg-") || name.startsWith("!bg-"));
  return <div className={cn("neo-card", !hasBackgroundClass && "bg-white", className)} {...props} />;
}

export function NeoButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("neo-button", className)} {...props}>{children}</button>;
}

export function StatusBadge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "orange" | "red" | "blue" }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

export function KcvMark({ dark = false }: { dark?: boolean }) {
  return <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full border-2 font-black tracking-tighter", dark ? "border-white text-white" : "border-black text-black")} aria-label="KCV">KCV</span>;
}
