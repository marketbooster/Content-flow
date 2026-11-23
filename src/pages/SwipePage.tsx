import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Empty, IdeaCardBody, PageHeader, PillarChip, SwipeDeck, formatLabel } from "../components/ui";
import { addDays, diffDays, formatNL } from "../domain/dates";
import { ideasFor, type IdeaSuggestion } from "../domain/ideas";
import { ALL_TEMPLATES } from "../domain/monthPlanner";
import { relevanceFor } from "../domain/relevance";
import type { ISODate } from "../domain/types";
import { useStore } from "../state/store";

export default function SwipePage() {
  const s = useStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "bewaard" ? "bewaard" : "seasonal";
  const byId = useMemo(() => new Map(s.events.map((e) => [e.id, e])), [s.events]);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const moments = useMemo(
    () =>
      s.occurrences
        .filter((o) => o.end >= s.today && diffDays(s.today, o.start) <= 120)
        .map((o) => ({ o, ev: byId.get(o.eventId)!, n: ideasFor(o, s.creator, s.feedback, s.content).length }))
        .filter((x) => x.n > 0 && relevanceFor(x.ev, s.creator).score >= 45),
    [s.occurrences, s.today, byId, s.creator, s.feedback, s.content],
  );
  const selectedKey = params.get("moment") ?? moments[0]?.o.key;
  const occ = s.occurrences.find((o) => o.key === selectedKey);
  const deck: IdeaSuggestion[] = occ ? ideasFor(occ, s.creator, s.feedback, s.content) : [];

  const tabs = (
    <div className="mb-4 inline-flex rounded-xl border border-line bg-card p-1 text-sm">
      {(["seasonal", "bewaard"] as const).map((t) => (
        <button key={t} onClick={() => setParams(t === "bewaard" ? { tab: t } : selectedKey ? { moment: selectedKey } : {})}
          className={`rounded-full px-3 py-1.5 ${tab === t ? "btn-gradient" : "text-muted"}`}>
          {t === "seasonal" ? "Seasonal" : `Bewaard (${savedIdeas(s).length})`}
        </button>
      ))}
    </div>
  );

  if (tab === "bewaard") return <><PageHeader kicker="Swipe Studio" title="Bewaarde ideeën" />{tabs}<SavedList /></>;

  return (
    <>
      <PageHeader kicker="Swipe Studio" title="Seasonal Swipe" sub="Rechts = bewaren, links = overslaan. Afgewezen ideeën komen niet terug." />
      {tabs}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {moments.map(({ o, ev, n }) => (
          <button key={o.key} onClick={() => setParams({ moment: o.key })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${o.key === selectedKey ? "border-accent bg-accent-soft text-accent" : "border-line bg-card"}`}>
            {ev.name} <span className="text-xs text-muted">· {formatNL(o.start)} · {n}</span>
          </button>
        ))}
      </div>
      {moments.length === 0 && !occ ? (
        <Empty>Geen open seizoensideeën voor de komende maanden. 🎉</Empty>
      ) : (
        <SwipeDeck
          items={deck}
          emptyText={<>Alles voor dit moment beoordeeld. <Link className="text-accent" to="?tab=bewaard">Bekijk je bewaarde ideeën →</Link></>}
          render={(i) => <IdeaCardBody t={i.template} publishDate={i.idealPublishDate} today={s.today} eventName={byId.get(i.occurrence.eventId)?.name} />}
          onKeep={(i) => { s.decide(i.key, "bewaard"); setLastAction(i.key); }}
          onSkip={(i) => { s.decide(i.key, "afgewezen"); setLastAction(i.key); }}
        />
      )}
      {lastAction && (
        <div className="mt-3 text-center">
          <Button variant="ghost" onClick={() => { s.undoDecision(lastAction); setLastAction(null); }}>↶ Ongedaan maken</Button>
        </div>
      )}
    </>
  );
}

function savedIdeas(s: ReturnType<typeof useStore>) {
  const planned = new Set(s.content.map((c) => c.ideaTemplateId && c.eventKey && `${c.ideaTemplateId}@${c.eventKey}`));
  return s.feedback
    .filter((f) => f.decision === "bewaard" && !planned.has(f.ideaKey))
    .map((f) => {
      const [templateId, eventKey] = f.ideaKey.split("@");
      const template = ALL_TEMPLATES.find((t) => t.id === templateId);
      const occ = s.occurrences.find((o) => o.key === eventKey);
      if (!template || !occ) return null;
      return { key: f.ideaKey, template, occ, ideal: addDays(occ.start, -template.publishDaysBefore) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.ideal < b.ideal ? -1 : 1));
}

function SavedList() {
  const s = useStore();
  const items = savedIdeas(s);
  const [dates, setDates] = useState<Record<string, ISODate>>({});
  const dateFor = (i: (typeof items)[number]) => dates[i.key] ?? (i.ideal < s.today ? s.today : i.ideal);
  const evName = (id: string) => s.events.find((e) => e.id === id)?.name;

  const plan = (list: typeof items) =>
    s.addContent(list.map((i) => ({
      title: i.template.title, hook: i.template.hook, description: i.template.description,
      pillar: i.template.pillar, format: i.template.format, status: "idee" as const, date: dateFor(i),
      eventKey: i.occ.key, ideaTemplateId: i.template.id, productionMinutes: i.template.productionMinutes,
      needsNutritionCalc: i.template.needsNutritionCalc, source: "seasonal" as const,
    })));

  if (items.length === 0) return <Empty>Nog geen bewaarde ideeën. Swipe naar rechts om ideeën te bewaren.</Empty>;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => plan(items)}>Alles inplannen ({items.length})</Button>
      </div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.key}>
            <Card>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="accent">{formatLabel(i.template.format)}</Badge><PillarChip id={i.template.pillar} /><Badge>{evName(i.occ.eventId)}</Badge>
              </div>
              <div className="mt-1.5 font-medium">{i.template.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted">
                  Publiceren op{" "}
                  <input type="date" value={dateFor(i)} min={s.today} onChange={(e) => setDates({ ...dates, [i.key]: e.target.value })}
                    className="rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink" />
                </label>
                {dateFor(i) === i.ideal ? <Badge tone="ok">ideale datum</Badge> : <Badge>ideaal: {formatNL(i.ideal)}</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => plan([i])}>Inplannen</Button>
                <Link className="inline-flex items-center rounded-xl border border-line px-3.5 py-2 text-sm" to={`/studio?idea=${encodeURIComponent(i.key)}`}>Variaties / uitwerken</Link>
                <Button variant="ghost" onClick={() => s.undoDecision(i.key)}>Terug naar stapel</Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
