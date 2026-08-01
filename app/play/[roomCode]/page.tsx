import { PlayClient } from "@/components/kcv/play-client";
export default async function PlayPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <PlayClient roomCode={decodeURIComponent(roomCode).toUpperCase()} />;
}
