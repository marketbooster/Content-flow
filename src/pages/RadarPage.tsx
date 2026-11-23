import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MonthGrid } from "../components/MonthGrid";
import { Badge, Button, Card, Empty, LinkButton, PageHeader, RelevanceMeter, SectionTitle } from "../components/ui";
import { diffDays, formatRange, monthName, relativeNL } from "../domain/dates";
import { EVENT_TYPE_LABELS } from "../domain/events";
import { ideasFor } from "../domain/ideas";
import { analyzeMix } from "../domain/mix";
import { currentStage, prepAlerts, relevanceFor } from "../domain/relevance";
import { useStore } from "../state/store";

export default function RadarPage() {
  const s = useStore();
  const { today, creator, events, occurrences, content, feedback } = s;
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const upcoming = useMemo(
    () =>
      occurrences
        .filter((o) => o.end >= today && diffDays(today, o.start) <= 70)
        .map((o) => {
          const ev = byId.get(o.eventId)!;
          return {
            occ: o, ev, rel: relevanceFor(ev, creator), stage: currentStage(ev, o, creator, today),
            ideas: ideasFor(o, creator, feedback, content).length,
            planned: content.filter((c) => c.eventKey === o.key).length,
          };
        })
        .filter((x) => x.rel.score >= 45)
        .sort((a, b) => (a.occ.start < b.occ.start ? -1 : 1)),
    [occurrences, byId, creator, feedback, content, today],
  );

  const alerts = useMemo(
    () => prepAlerts(events, occurrences, creator, today, new Set(s.seenAlerts)),
    [events, occurrences, creator, today, s.seenAlerts],
  );
  const signals = useMemo(
    () => analyzeMix(content, creator, events, occurrences, today),
    [content, creator, events, occurrences, today],
  );

  const [y, m] = today.split("-").map(Number);

  return (
    <>
      <PageHeader
        kicker="ContentFlow / Seasonal Radar"
        title="Jouw kansen voor de komende weken ✨"
        sub={`${monthName(m)} ${y} · ${creator.handle}`}
      />

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <Card key={a.key} className="flex items-start gap-3 border-accent/30 bg-accent-soft">
              <div className="flex-1">
                <div className="text-xs font-semibold text-accent">{a.stage.label}</div>
                <p className="mt-0.5 text-sm">{a.message}</p>
                <div className="mt-2 flex gap-2">
                  <LinkButton to={`/swipe?moment=${encodeURIComponent(a.occurrence.key)}`} variant="primary">Ideeën bekijken</LinkButton>
                  <Button variant="ghost" onClick={() => s.markAlertsSeen([a.key])}>Later</Button>
                </div>
              </div>
            </Card>
          ))}
          <p className="text-[11px] text-muted">
            Maximaal {creator.notifications.maxPerWeek} meldingen per week · aan te passen in Instellingen.
          </p>
        </div>
      )}

      <Card className="mt-4 bg-brand border-transparent shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Maak mijn maandplanning</div>
            <p className="text-sm opacity-80">Eén klik: momenten, pijlers en jouw tijd → een voorstel om te swipen.</p>
          </div>
          <Link to="/maandplanning" className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1a0e2e] shadow-sm">Start ✨</Link>
        </div>
      </Card>

      <SectionTitle action={<Link to="/kalender" className="text-xs text-accent">Kalender →</Link>}>
        {monthName(m)}
      </SectionTitle>
      <Card>
        <MonthGrid year={y} month={m} compact minRelevance={55} />
      </Card>

      <SectionTitle>Aankomende inhakers</SectionTitle>
      {upcoming.length === 0 ? (
        <Empty>Geen relevante momenten in de komende 10 weken.</Empty>
      ) : (
        <ul className="space-y-2">
          {upcoming.map(({ occ, ev, rel, stage, ideas, planned }) => (
            <li key={occ.key}>
              <Link to={`/moment/${encodeURIComponent(occ.key)}`} className="block rounded-2xl border border-line bg-card p-4 hover:border-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{ev.name} · <span className="font-normal text-muted">{formatRange(occ.start, occ.end)}</span></div>
                    <div className="mt-0.5 text-sm text-muted">{ev.contentCategories.slice(0, 3).join(", ")}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{occ.start <= today ? "nu" : relativeNL(today, occ.start)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RelevanceMeter score={rel.score} />
                  <Badge>{EVENT_TYPE_LABELS[ev.type]}</Badge>
                  {stage && <Badge tone="accent">Fase: {stage.stage.label.split(" ")[0]}</Badge>}
                  <Badge tone="plum">{ideas} ideeën</Badge>
                  {planned > 0 && <Badge tone="ok">{planned} gepland</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {signals.length > 0 && (
        <>
          <SectionTitle>Contentmix</SectionTitle>
          <ul className="space-y-2">
            {[...signals].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "let_op" ? -1 : 1)).slice(0, 3).map((sig) => (
              <li key={sig.id}>
                <Card>
                  <div className="flex items-center gap-2">
                    <Badge tone={sig.severity === "let_op" ? "warn" : "neutral"}>{sig.severity === "let_op" ? "Let op" : "Tip"}</Badge>
                    <span className="text-sm font-medium">{sig.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{sig.detail}</p>
                  <p className="mt-1 text-sm">{sig.suggestion}</p>
                  {sig.relatedOccurrenceKey && (
                    <Link className="mt-2 inline-block text-sm text-accent" to={`/swipe?moment=${encodeURIComponent(sig.relatedOccurrenceKey)}`}>Naar ideeën →</Link>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Suggesties wijzigen nooit automatisch je planning.</p>
        </>
      )}
    </>
  );
}
