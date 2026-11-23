import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, Empty, LinkButton, PageHeader, PillarChip, RelevanceMeter, ReliabilityBadge, SectionTitle, formatLabel } from "../components/ui";
import { addDays, diffDays, formatNL, formatRange, relativeNL } from "../domain/dates";
import { EVENT_TYPE_LABELS } from "../domain/events";
import { ideasFor } from "../domain/ideas";
import { currentStage, relevanceFor, stagesFor } from "../domain/relevance";
import { useStore } from "../state/store";

export default function EventPage() {
  const key = decodeURIComponent(useParams().key ?? "");
  const s = useStore();
  const occ = s.occurrences.find((o) => o.key === key);
  const ev = occ && s.events.find((e) => e.id === occ.eventId);
  if (!occ || !ev) return <Empty>Dit moment is niet (meer) in je kalender te vinden.</Empty>;

  const rel = relevanceFor(ev, s.creator);
  const stage = currentStage(ev, occ, s.creator, s.today);
  const stages = stagesFor(ev, s.creator).sort((a, b) => b.daysBefore - a.daysBefore);
  const ideas = ideasFor(occ, s.creator, s.feedback, s.content);
  const planned = s.content.filter((c) => c.eventKey === occ.key);
  const muted = s.creator.mutedEventIds.includes(ev.id);

  return (
    <>
      <Link to="/" className="text-sm text-muted">← Radar</Link>
      <PageHeader
        kicker={EVENT_TYPE_LABELS[ev.type]}
        title={ev.name}
        sub={<>{formatRange(occ.start, occ.end)} {occ.start.slice(0, 4)} · {occ.start >= s.today ? relativeNL(s.today, occ.start) : "loopt nu"}</>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ReliabilityBadge r={occ.reliability} />
        <RelevanceMeter score={rel.score} />
        <Badge>{ev.region === "INT" ? "Internationaal" : ev.region}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted">{rel.reason}.</p>
      {ev.description && <p className="mt-2 text-sm">{ev.description}</p>}
      <p className="mt-2 text-xs text-muted">
        Bron: {ev.source.url ? <a className="underline" href={ev.source.url} target="_blank" rel="noreferrer">{ev.source.label}</a> : ev.source.label}
        {ev.lastVerified && <> · laatst geverifieerd {formatNL(ev.lastVerified, { year: true })}</>}
      </p>
      {occ.reliability === "te_verifieren" && (
        <Card className="mt-3 border-warn/40 bg-warn-soft text-sm">
          Deze datum is nog niet bij de bron gecontroleerd. Check de bron voordat je er een campagne op bouwt.
        </Card>
      )}

      <SectionTitle>Voorbereiding</SectionTitle>
      <Card>
        <ol className="space-y-2">
          {stages.map((st) => {
            const date = addDays(occ.start, -st.daysBefore);
            const active = stage?.stage.id === st.id;
            const past = diffDays(s.today, date) < 0 && !active;
            return (
              <li key={st.id} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${active ? "bg-accent-soft font-medium text-accent" : past ? "text-muted line-through decoration-line" : ""}`}>
                <span>{st.label}</span>
                <span className="shrink-0 tabular text-xs">{formatNL(date)}{st.daysBefore ? ` · ${st.daysBefore === 0 ? "" : `${Math.round(st.daysBefore / 7)} wk vooraf`}` : ""}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <SectionTitle>Creatieve invalshoeken</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {ev.contentCategories.map((c) => <Badge key={c} tone="plum">{c}</Badge>)}
      </div>

      <SectionTitle action={ideas.length > 0 && <LinkButton to={`/swipe?moment=${encodeURIComponent(occ.key)}`} variant="primary">Swipe {ideas.length} ideeën</LinkButton>}>
        Ideeën voor jou
      </SectionTitle>
      {ideas.length === 0 ? (
        <Empty>Geen nieuwe ideeën meer: je hebt ze allemaal beoordeeld of ingepland. Genereer variaties in de Studio.</Empty>
      ) : (
        <ul className="space-y-2">
          {ideas.slice(0, 4).map((i) => (
            <li key={i.key}>
              <Card>
                <div className="flex flex-wrap gap-1.5"><Badge tone="accent">{formatLabel(i.template.format)}</Badge><PillarChip id={i.template.pillar} /></div>
                <div className="mt-1.5 font-medium">{i.template.title}</div>
                <div className="text-xs text-muted">Ideaal: {formatNL(i.idealPublishDate, { weekday: true })}</div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Gepland voor dit moment</SectionTitle>
      {planned.length === 0 ? <Empty>Nog niets gekoppeld.</Empty> : (
        <ul className="space-y-2">
          {planned.map((c) => (
            <li key={c.id}>
              <Link to={`/content/${c.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-card p-3 text-sm">
                <span className="font-medium">{c.title}</span>
                <span className="text-xs text-muted">{c.date ? formatNL(c.date) : "geen datum"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <LinkButton to={`/studio?moment=${encodeURIComponent(occ.key)}`}>Nieuw idee in Studio</LinkButton>
        <Button variant="ghost" onClick={() =>
          s.updateCreator({ mutedEventIds: muted ? s.creator.mutedEventIds.filter((x) => x !== ev.id) : [...s.creator.mutedEventIds, ev.id] })}>
          {muted ? "Moment weer tonen" : "Dit moment niet meer voorstellen"}
        </Button>
      </div>
    </>
  );
}
