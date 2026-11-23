import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Empty, IdeaCardBody, PageHeader, SectionTitle, SwipeDeck } from "../components/ui";
import { daysInMonth, diffDays, formatNL, monthName, ymd } from "../domain/dates";
import { planMonth, type MonthProposal } from "../domain/monthPlanner";
import { PILLAR_SHORT } from "../domain/profile";
import type { PillarId } from "../domain/types";
import { useStore } from "../state/store";

export default function MonthPlanPage() {
  const s = useStore();
  const [ty, tm] = s.today.split("-").map(Number);
  // Minder dan 10 dagen over in deze maand? Dan standaard de volgende maand.
  const daysLeft = diffDays(s.today, ymd(ty, tm, daysInMonth(ty, tm)));
  const def = daysLeft < 10 ? (tm === 12 ? { y: ty + 1, m: 1 } : { y: ty, m: tm + 1 }) : { y: ty, m: tm };
  const [target, setTarget] = useState(def);
  const [run, setRun] = useState<{ proposals: MonthProposal[]; meta: ReturnType<typeof planMonth> } | null>(null);
  const [approved, setApproved] = useState<MonthProposal[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string[] | null>(null);

  const generate = () => {
    const r = planMonth({ year: target.y, month: target.m, creator: s.creator, events: s.events, content: s.content, feedback: s.feedback, today: s.today });
    setRun({ proposals: r.proposals, meta: r });
    setApproved([]);
    setSkipped(new Set());
    setDone(null);
  };

  const remaining = useMemo(
    () => (run ? run.proposals.filter((p) => !skipped.has(p.key) && !approved.some((a) => a.key === p.key)) : []),
    [run, approved, skipped],
  );

  const options = [0, 1, 2].map((i) => {
    const m = ((tm - 1 + i) % 12) + 1;
    return { y: ty + Math.floor((tm - 1 + i) / 12), m };
  });

  const commit = () => {
    const ids = s.addContent(approved.map((p) => ({
      title: p.template.title, hook: p.template.hook, description: p.template.description,
      pillar: p.template.pillar, format: p.template.format, status: "gepland" as const, date: p.date,
      eventKey: p.occurrence?.key, ideaTemplateId: p.template.id, productionMinutes: p.template.productionMinutes,
      needsNutritionCalc: p.template.needsNutritionCalc, source: "maandplanning" as const,
    })));
    // Afgewezen voorstellen niet opnieuw voorstellen.
    for (const key of skipped) s.decide(key, "afgewezen");
    for (const p of approved) s.decide(p.key, "bewaard");
    setDone(ids);
  };

  return (
    <>
      <PageHeader kicker="Eén knop" title="Maak mijn maandplanning"
        sub="Op basis van je beschikbare tijd, seizoensmomenten, contentpijlers en wat je al gepland hebt. Jij beslist wat blijft." />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {options.map((o) => (
            <button key={`${o.y}-${o.m}`} onClick={() => { setTarget(o); setRun(null); }}
              className={`rounded-full border px-3 py-1.5 text-sm ${o.y === target.y && o.m === target.m ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>
              {monthName(o.m)} {o.y}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Beschikbare tijd: {s.creator.hoursPerWeek} uur per week (aan te passen in Instellingen).</p>
        <Button className="mt-3 w-full" onClick={generate}>✨ Maak voorstel voor {monthName(target.m)}</Button>
      </Card>

      {run && !done && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Capaciteit" value={`${Math.round(run.meta.capacityMinutes / 60)} u`} />
            <Stat label="Al gepland" value={`${Math.round(run.meta.alreadyPlannedMinutes / 60)} u`} />
            <Stat label="Voorstel" value={`${Math.round(run.meta.usedMinutes / 60)} u · ${run.proposals.length}×`} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {summarize(run.proposals).map(([p, n]) => <Badge key={p} tone="plum">{n}× {PILLAR_SHORT[p]}</Badge>)}
          </div>

          <SectionTitle>Swipe je maand</SectionTitle>
          {run.proposals.length === 0 ? (
            <Empty>Geen voorstellen: je maand zit al vol, of er is te weinig tijd beschikbaar.</Empty>
          ) : (
            <SwipeDeck
              items={remaining}
              emptyText={approved.length ? "Klaar met swipen!" : "Je hebt alles overgeslagen. Probeer het opnieuw of pas je pijlers aan."}
              render={(p) => (
                <>
                  <IdeaCardBody t={p.template} publishDate={p.date} today={s.today} eventName={p.eventName} />
                  <p className="mt-3 text-xs text-muted">Waarom: {p.reason}</p>
                </>
              )}
              onKeep={(p) => setApproved((a) => [...a, p])}
              onSkip={(p) => setSkipped((prev) => new Set([...prev, p.key]))}
            />
          )}

          {approved.length > 0 && (
            <Card className="mt-5">
              <div className="font-medium">{approved.length} goedgekeurd</div>
              <ul className="mt-2 space-y-1 text-sm">
                {approved.map((p) => <li key={p.key} className="flex justify-between gap-2"><span>{p.template.title}</span><span className="shrink-0 text-muted">{formatNL(p.date)}</span></li>)}
              </ul>
              <Button className="mt-3 w-full" onClick={commit}>Inplannen in mijn kalender</Button>
            </Card>
          )}
        </>
      )}

      {done && (
        <Card className="mt-4 border-ok/40 bg-ok-soft">
          <div className="font-semibold">✓ {done.length} items ingepland</div>
          <p className="mt-1 text-sm">Volgende stap: laat per item een script en shotlist uitwerken in de Content Studio (optioneel, kost AI-tegoed).</p>
          <div className="mt-3 flex gap-2">
            <Link to="/kalender" className="rounded-xl border border-line bg-card px-3.5 py-2 text-sm">Bekijk kalender</Link>
            <Link to={`/studio?content=${done[0]}`} className="rounded-xl bg-accent px-3.5 py-2 text-sm text-white">Script maken voor het eerste item</Link>
          </div>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-card p-2"><div className="text-muted">{label}</div><div className="mt-0.5 font-semibold tabular">{value}</div></div>;
}

function summarize(ps: MonthProposal[]): [PillarId, number][] {
  const m = new Map<PillarId, number>();
  for (const p of ps) m.set(p.template.pillar, (m.get(p.template.pillar) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
