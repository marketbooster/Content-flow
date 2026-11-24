import { notFound } from "next/navigation";
import { repo } from "@/lib/db";
import { Teleprompter } from "@/components/teleprompter";

export const dynamic = "force-dynamic";

export default async function TeleprompterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await (await repo()).getInboxItem(id);
  if (!item?.payload.reel) notFound();
  const r = item.payload.reel;
  const lines = [r.hook, ...r.shots.map((s) => s.voiceover), r.cta].filter(Boolean);
  return <Teleprompter title={item.title} lines={lines} shots={r.shots.map((s) => s.visual)} />;
}
