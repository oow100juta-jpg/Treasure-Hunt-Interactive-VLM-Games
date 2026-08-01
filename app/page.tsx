import Link from "next/link";
import { ArrowDown, Camera, ScanSearch, Trophy } from "lucide-react";
import { HuntIllustration } from "@/components/kcv/illustrations";
import { JoinForm } from "@/components/kcv/join-form";
import { KcvMark } from "@/components/kcv/neo";

export default function HomePage() {
  return (
    <main>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div className="flex items-center gap-3"><KcvMark /><span className="display text-lg">Vision Hunt</span></div><Link href="/admin" className="text-sm font-bold underline decoration-2 underline-offset-4">Admin portal</Link></nav>
      <section className="mx-auto grid min-h-[calc(100dvh-80px)] max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-[1.05fr_.95fr] md:py-16">
        <div>
          <h1 className="display max-w-2xl text-[clamp(4.25rem,12vw,8.5rem)] leading-[.78] tracking-[-.065em]">Search.<br />See.<br /><span className="text-kcv-blue">Snap.</span></h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-zinc-600">Chase semantic clues, capture the unexpected, and let AI decide. Every second and every attempt counts.</p>
        </div>
            <div><JoinForm /></div>
        {/* <div className="relative"><div className="absolute inset-10 -rotate-3 rounded-[3rem] bg-kcv-yellow" /><HuntIllustration className="relative w-full" /></div> */}
      </section>
      <section className="border-y-2 border-black bg-black py-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-3">
          {[[ScanSearch,"01","Decode the clue","Think beyond exact objects. Find anything that genuinely fits."],[Camera,"02","Capture it","Use your camera or upload a sharp photo from your gallery."],[Trophy,"03","Climb the ranks","Earn more for fast, first-try finds before rankings freeze."]].map(([Icon,n,title,copy]) => { const StepIcon = Icon as typeof ScanSearch; return <div key={String(n)} className="border-t border-white/30 pt-5"><div className="mb-8 flex items-center justify-between"><StepIcon /><span className="font-mono text-xs">{String(n)}</span></div><h2 className="display text-2xl">{String(title)}</h2><p className="mt-2 text-sm leading-relaxed text-zinc-400">{String(copy)}</p></div>; })}
        </div>
      </section>
      <footer className="flex items-center justify-between bg-black px-5 py-6 text-xs text-white"><span>© KCV VISION HUNT</span><span>SEARCH · SEE · SNAP</span></footer>
    </main>
  );
}
