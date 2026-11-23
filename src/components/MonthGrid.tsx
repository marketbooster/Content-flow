import { useMemo } from "react";
import { Link } from "react-router-dom";
import { addDays, daysInMonth, weekday, ymd } from "../domain/dates";
import { relevanceFor } from "../domain/relevance";
import type { EventType, ISODate } from "../domain/types";
import { useStore } from "../state/store";

const WD = ["M", "D", "W", "D", "V", "Z", "Z"];

/** Maandraster (ma–zo). Toont alleen momenten boven de relevantiedrempel + eigen content. */
export function MonthGrid({
  year, month, compact = false, minRelevance = 50, types, selected, onSelect,
}: {
  year: number; month: number; compact?: boolean; minRelevance?: number; types?: Set<EventType>;
  selected?: ISODate; onSelect?: (d: ISODate) => void;
}) {
  const { occurrences, events, creator, content, today } = useStore();
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const first = ymd(year, month, 1);
  const last = ymd(year, month, daysInMonth(year, month));
  const lead = (weekday(first) + 6) % 7;

  const dayInfo = useMemo(() => {
    const m = new Map<ISODate, { events: { key: string; name: string; weight: number }[]; content: number }>();
    for (const o of occurrences) {
      if (o.end < first || o.start > last) continue;
      const ev = byId.get(o.eventId)!;
      if (types && !types.has(ev.type)) continue;
      if (relevanceFor(ev, creator).score < minRelevance) continue;
      // Lange periodes (maanden/seizoenen) alleen op de startdag markeren, anders wordt het raster vol.
      const long = o.start !== o.end && (o.end > addDays(o.start, 3));
      const days: ISODate[] = [];
      if (long) { if (o.start >= first) days.push(o.start); }
      else for (let d = o.start; d <= o.end; d = addDays(d, 1)) if (d >= first && d <= last) days.push(d);
      for (const d of days) {
        const cur = m.get(d) ?? { events: [], content: 0 };
        cur.events.push({ key: o.key, name: ev.name, weight: ev.weight });
        m.set(d, cur);
      }
    }
    for (const c of content) {
      if (!c.date || c.date < first || c.date > last) continue;
      const cur = m.get(c.date) ?? { events: [], content: 0 };
      cur.content += 1;
      m.set(c.date, cur);
    }
    return m;
  }, [occurrences, byId, creator, content, first, last, minRelevance, types]);

  const cells: (ISODate | null)[] = [...Array(lead).fill(null)];
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(ymd(year, month, d));

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted">
        {WD.map((w, i) => <div key={i} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const info = dayInfo.get(d);
          const isToday = d === today;
          const big = info?.events.some((e) => e.weight === 3);
          const cls = `relative flex ${compact ? "h-10" : "h-16 md:h-20"} flex-col items-center rounded-lg p-1 text-xs tabular ${
            selected === d ? "ring-2 ring-accent" : ""
          } ${isToday ? "bg-ink text-paper" : big ? "bg-accent-soft" : info?.events.length ? "bg-plum-soft" : ""}`;
          const inner = (
            <>
              <span className={isToday ? "font-semibold" : ""}>{Number(d.slice(8))}</span>
              {!compact && info?.events[0] && (
                <span className="mt-0.5 line-clamp-2 w-full text-center text-[9px] leading-tight md:text-[10px]">{info.events[0].name}</span>
              )}
              <span className="absolute bottom-1 flex gap-0.5">
                {info?.events.length ? <span className="size-1.5 rounded-full bg-accent" /> : null}
                {info?.content ? <span className="size-1.5 rounded-full bg-ok" /> : null}
              </span>
            </>
          );
          if (onSelect) return <button key={d} className={cls} onClick={() => onSelect(d)} aria-label={d}>{inner}</button>;
          const target = info?.events[0]?.key;
          return target
            ? <Link key={d} to={`/moment/${encodeURIComponent(target)}`} className={cls} title={info!.events.map((e) => e.name).join(", ")}>{inner}</Link>
            : <div key={d} className={cls}>{inner}</div>;
        })}
      </div>
      <div className="mt-2 flex gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-accent" /> inhaker</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-ok" /> geplande content</span>
      </div>
    </div>
  );
}
