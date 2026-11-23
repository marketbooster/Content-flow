import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MonthGrid } from "../components/MonthGrid";
import { mondayOf, weekLabel, WeekView } from "../components/WeekView";
import { Badge, Button, Card, Empty, PageHeader, PillarChip, ReliabilityBadge, SectionTitle, formatLabel } from "../components/ui";
import { addDays, formatNL, monthName } from "../domain/dates";
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
  const [view, setView] = useState<"week" | "maand">("week");
  const [monday, setMonday] = useState<ISODate>(mondayOf(s.today));
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

  const [draft, setDraft] = useState<string | null>(null);
  const addManual = () => {
    const title = draft?.trim();
    if (!title) return;
    s.addContent([{ title, pillar: "afvallen", format: "reel", status: "idee", date: selected, source: "handmatig" }]);
    setDraft(null);
  };

  return (
    <>
      <PageHeader kicker="Contentkalender" title={view === "week" ? weekLabel(monday) : `${monthName(ym.m)} ${ym.y}`}
        action={<div className="flex gap-1">
          <Button variant="secondary" onClick={() => (view === "week" ? setMonday(addDays(monday, -7)) : shift(-1))} title="Vorige">‹</Button>
          <Button variant="secondary" onClick={() => (view === "week" ? setMonday(addDays(monday, 7)) : shift(1))} title="Volgende">›</Button>
        </div>} />

      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex rounded-full border border-line bg-card p-1 text-sm" role="tablist">
          {(["week", "maand"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 ${view === v ? "btn-gradient" : "text-muted"}`}>{v === "week" ? "Week" : "Maand"}</button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => { setMonday(mondayOf(s.today)); setYm({ y: ty, m: tm }); setSelected(s.today); }}>Vandaag</Button>
      </div>

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

      {view === "week" ? (
        <>
          <WeekView monday={monday} minRelevance={minRel} types={types} />
          <p className="mt-2 text-xs text-muted">Sleep een item naar een andere dag om het te verplaatsen. Op je telefoon: even vasthouden.</p>
        </>
      ) : (
        <>
        <Card>
          <MonthGrid year={ym.y} month={ym.m} minRelevance={minRel} types={types} selected={selected} onSelect={setSelected} />
        </Card>

        <SectionTitle action={draft === null && <Button variant="ghost" onClick={() => setDraft("")}>+ Contentitem</Button>}>
          {formatNL(selected, { weekday: true, year: true })}
        </SectionTitle>
        {draft !== null && (
          <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); addManual(); }}>
            <input id="new-content-title" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Titel van het contentitem"
              className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm" />
            <Button type="submit" disabled={!draft.trim()}>Toevoegen</Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Annuleer</Button>
          </form>
        )}
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
      )}
    </>
  );
}
