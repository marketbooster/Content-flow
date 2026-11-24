import { repo } from "@/lib/db";
import { emptySlotsInWeek, weekVariation } from "@/lib/slots";
import { amsDayAt, startOfAmsWeek } from "@/lib/time";
import { CalendarClient } from "@/components/calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const offset = Math.max(-4, Math.min(12, Number(w ?? 0) || 0));
  const r = await repo();
  const weekStart = amsDayAt(startOfAmsWeek(new Date()), offset * 7, 0, 0);
  const weekEnd = amsDayAt(weekStart, 7, 0, 0);

  const [ideas, entries] = await Promise.all([r.listIdeas(["new"], 10), r.listCalendar(weekStart, weekEnd)]);
  const live = entries.filter((e) => e.status !== "failed" || e.inbox_item_id);
  const days = Array.from({ length: 7 }, (_, i) => amsDayAt(weekStart, i, 0, 0).toISOString());

  return (
    <CalendarClient
      ideas={ideas}
      entries={entries}
      days={days}
      offset={offset}
      emptySlots={emptySlotsInWeek(weekStart, live).filter((s) => s.at > new Date()).map((s) => ({ ...s, at: s.at.toISOString() }))}
      warnings={offset >= 0 ? weekVariation(live).warnings : []}
    />
  );
}
