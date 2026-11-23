import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MonthGrid } from "../components/MonthGrid";
import { Badge, Button, Card, Empty, PageHeader, PillarChip, ReliabilityBadge, SectionTitle, formatLabel } from "../components/ui";
import { formatNL, monthName } from "../domain/dates";
import { EVENT_TYPE_LABELS } from "../domain/events";
import { relevanceFor } from "../domain/relevance";
import type { EventType, ISODate } from "../domain/types";
import { useStore } from "../state/store";

const TYPE_FILTERS: EventType[] = ["feestdag_nl", "feestdag_int", "commercieel", "seizoen", "awareness", "niche", "schoolvakantie", "sport", "cultureel", "persoonlijk", "trend"];

export default function CalendarPage() {
  const s = useStore();
  const [ty, tm] = s.today.split("-").map(Number);
  const [ym, setYm] = useState({ y: ty, m: tm });
  const [minRel, setMinRel] = useState(50);
  const [types, setTypes] = useState<Set<EventType>>(new Set(TYPE_FILTERS));
  const [selected, setSelected] = useState<ISODate>(s.today);
  const byId = useMemo(() => new Map(s.events.map((e) => [e.id, e])), [s.events]);

  const shift = (d: number) => setYm(({ y, m }) => {
    const n = m + d;
    return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n };
  });

  const dayEvents = s.occurrences
    .filter((o) => o.start <= selected && o.end >= selected)
    .map((o) => ({ o, ev: byId.get(o.eventId)! }))
    .filter(({ ev }) => types.has(ev.type) && relevanceFor(ev, s.creator).score >= minRel);
  const dayContent = s.content.filter((c) => c.date === selected);

  const addManual = () => {
    const title = prompt("Titel van het contentitem");
    if (!title) return;
    s.addContent([{ title, pillar: "afvallen", format: "reel", status: "gepland", date: selected, source: "handmatig" }]);
  };

  return (
    <>
      <PageHeader kicker="Contentkalender" title={`${monthName(ym.m)} ${ym.y}`}
        action={<div className="flex gap-1"><Button variant="secondary" onClick={() => shift(-1)} title="Vorige maand">‹</Button><Button variant="secondary" onClick={() => shift(1)} title="Volgende maand">›</Button></div>} />

      <details className="mb-3 rounded-2xl border border-line bg-card p-3 text-sm">
        <summary className="cursor-pointer font-medium">Filters · relevantie ≥ {minRel}% · {types.size} types</summary>
        <label className="mt-3 block">
          <span className="text-muted">Minimale relevantie</span>
          <input type="range" min={0} max={90} step={5} value={minRel} onChange={(e) => setMinRel(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <button key={t} onClick={() => setTypes((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; })}
              className={`rounded-full border px-2.5 py-1 text-xs ${types.has(t) ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
              {EVENT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </details>

      <Card>
        <MonthGrid year={ym.y} month={ym.m} minRelevance={minRel} types={types} selected={selected} onSelect={setSelected} />
      </Card>

      <SectionTitle action={<Button variant="ghost" onClick={addManual}>+ Contentitem</Button>}>
        {formatNL(selected, { weekday: true, year: true })}
      </SectionTitle>
      {dayEvents.length === 0 && dayContent.length === 0 && <Empty>Niets gepland en geen relevante momenten op deze dag.</Empty>}
      <ul className="space-y-2">
        {dayEvents.map(({ o, ev }) => (
          <li key={o.key}>
            <Link to={`/moment/${encodeURIComponent(o.key)}`} className="flex items-center justify-between rounded-2xl border border-line bg-card p-3">
              <span className="font-medium">{ev.name}</span>
              <span className="flex gap-1.5"><Badge>{EVENT_TYPE_LABELS[ev.type]}</Badge><ReliabilityBadge r={o.reliability} /></span>
            </Link>
          </li>
        ))}
        {dayContent.map((c) => (
          <li key={c.id}>
            <Link to={`/content/${c.id}`} className="flex items-center justify-between gap-2 rounded-2xl border border-ok/30 bg-ok-soft p-3">
              <span className="font-medium">{c.title}</span>
              <span className="flex shrink-0 gap-1.5"><Badge tone="accent">{formatLabel(c.format)}</Badge><PillarChip id={c.pillar} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
