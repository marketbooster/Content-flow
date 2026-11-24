import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../App";
import { Badge, Card, Empty, PillarChip, SectionTitle, formatLabel } from "../components/ui";
import { addDays, diffDays, formatNL } from "../domain/dates";
import { dealSignals } from "../domain/deals";
import { prepAlerts, relevanceFor } from "../domain/relevance";
import { CONTENT_STATUSES, type ContentItem } from "../domain/types";
import { SOURCE_INFO, useInbox } from "../state/inbox";
import { useStore } from "../state/store";

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("nl-NL", { hour: "numeric", hour12: false, timeZone: "Europe/Amsterdam" }).format(now));
  return h < 12 ? "Goedemorgen" : h < 18 ? "Goedemiddag" : "Goedenavond";
}

const statusLabel = (s: ContentItem["status"]) => CONTENT_STATUSES.find((x) => x.id === s)?.label ?? s;

export default function TodayPage() {
  const s = useStore();
  const { today, content, creator, events, occurrences } = s;
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  // Volgende grote, relevante moment voor de countdown.
  const next = useMemo(
    () => occurrences
      .filter((o) => o.start > today)
      .map((o) => ({ o, ev: byId.get(o.eventId)! }))
      .find(({ ev }) => ev.weight === 3 && relevanceFor(ev, creator).score >= 60),
    [occurrences, byId, creator, today],
  );

  const shootToday = s.shootDays.find((d) => d.date === today);
  const nextShoot = s.shootDays.filter((d) => d.date > today).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const postToday = content.filter((c) => c.date === today && c.status !== "gepubliceerd");
  const week = content
    .filter((c) => c.date && c.date > today && c.date <= addDays(today, 7) && c.status !== "gepubliceerd")
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const atRisk = week.filter((c) => diffDays(today, c.date!) <= 2 && (c.status === "idee" || c.status === "script"));
  const signals = dealSignals(s.deals, content, today).filter((x) => x.severity === "let_op").slice(0, 3);
  const alerts = prepAlerts(events, occurrences, creator, today, new Set(s.seenAlerts)).slice(0, 2);
  const inbox = useInbox();
  const perSource = [...new Set(inbox.fresh.map((i) => i.source))].map((src) => ({ src, n: inbox.fresh.filter((i) => i.source === src).length }));

  return (
    <>
      <header className="mb-5">
        <div className="text-sm text-muted">{formatNL(today, { weekday: true, year: true })}</div>
        <h1 className="text-3xl font-semibold">{greeting()} 👋</h1>
      </header>

      {next && (
        <Link to={`/moment/${encodeURIComponent(next.o.key)}`} className="bg-brand shadow-soft relative block overflow-hidden rounded-3xl p-5">
          <span className="tape absolute right-4 top-4">countdown</span>
          <div className="text-sm opacity-80">Volgende grote moment</div>
          <div className="mt-1 font-display text-4xl font-semibold tabular">
            {diffDays(today, next.o.start)} <span className="text-2xl">dagen</span>
          </div>
          <div className="mt-1 text-lg">tot {next.ev.name}</div>
          <div className="mt-3 text-sm opacity-90">
            {content.filter((c) => c.eventKey === next.o.key).length} item(s) gepland · bekijk ideeën →
          </div>
        </Link>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <QuickAction to="/swipe" icon="swipe" label="Ideeën swipen" />
        <QuickAction to="/opnamedag" icon="opname" label="Opnamedag" />
        <QuickAction to="/maandplanning" icon="plan" label="Maandplan" />
      </div>

      {inbox.fresh.length > 0 && (
        <Link to="/bord" className="mt-4 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-4">
          <span className="text-2xl" aria-hidden>📥</span>
          <span className="min-w-0 flex-1">
            <b>{inbox.fresh.length} nieuwe tip{inbox.fresh.length === 1 ? "" : "s"}</b>
            <span className="block truncate text-sm text-muted">{perSource.map(({ src, n }) => `${SOURCE_INFO[src].emoji} ${n} ${SOURCE_INFO[src].label}`).join(" · ")}</span>
          </span>
          <span className="text-sm font-semibold text-accent">Bekijk →</span>
        </Link>
      )}

      <SectionTitle>Vandaag</SectionTitle>
      <div className="space-y-2">
        {shootToday && (
          <Link to={`/opnamedag?dag=${shootToday.id}`} className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-4">
            <span className="text-2xl" aria-hidden>🎬</span>
            <span className="flex-1"><b>Opnamedag</b> · {shootToday.contentIds.length} video's · ± {Math.round(shootToday.minutesAvailable / 60)} uur</span>
            <span className="text-sm text-accent">Openen →</span>
          </Link>
        )}
        {postToday.map((c) => <ContentRow key={c.id} c={c} label="Vandaag posten" />)}
        {!shootToday && postToday.length === 0 && (
          <Empty>Niets gepland voor vandaag.{nextShoot && <> Volgende opnamedag: {formatNL(nextShoot.date, { weekday: true })}.</>}</Empty>
        )}
      </div>

      {(atRisk.length > 0 || signals.length > 0) && (
        <>
          <SectionTitle>Let op</SectionTitle>
          <div className="space-y-2">
            {atRisk.map((c) => (
              <Card key={c.id} className="border-warn/40 bg-warn-soft text-sm">
                <b>{c.title}</b> gaat {formatNL(c.date!, { weekday: true })} live, maar staat nog op “{statusLabel(c.status)}”.{" "}
                <Link to="/opnamedag" className="font-semibold text-accent">Plan opname →</Link>
              </Card>
            ))}
            {signals.map((x) => (
              <Card key={x.id} className="border-warn/40 bg-warn-soft text-sm">
                <b>{x.title}</b> · {x.detail} <Link to="/deals" className="font-semibold text-accent">Bekijk →</Link>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle action={<Link to="/kalender" className="text-xs font-semibold text-accent">Kalender →</Link>}>Komende 7 dagen</SectionTitle>
      {week.length === 0 ? (
        <Empty>Nog niets gepland deze week. <Link className="font-semibold text-accent" to="/maandplanning">Maak een maandplanning →</Link></Empty>
      ) : (
        <ul className="space-y-2">{week.map((c) => <li key={c.id}><ContentRow c={c} label={formatNL(c.date!, { weekday: true })} /></li>)}</ul>
      )}

      {alerts.length > 0 && (
        <>
          <SectionTitle action={<Link to="/radar" className="text-xs font-semibold text-accent">Seasonal Radar →</Link>}>Seizoenskansen</SectionTitle>
          <div className="space-y-2">
            {alerts.map((a) => (
              <Link key={a.key} to={`/swipe?moment=${encodeURIComponent(a.occurrence.key)}`} className="block rounded-2xl border border-line bg-card p-4 text-sm hover:border-accent/50">
                <div className="text-xs font-semibold text-accent">{a.stage.label}</div>
                {a.message}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: Parameters<typeof Icon>[0]["name"]; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-card p-3 font-medium hover:border-accent/50">
      <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent"><Icon name={icon} /></span>
      {label}
    </Link>
  );
}

function ContentRow({ c, label }: { c: ContentItem; label: string }) {
  return (
    <Link to={`/content/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 hover:border-accent/50">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="truncate font-medium">{c.title}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={c.status === "bewerkt" ? "ok" : c.status === "idee" ? "warn" : "neutral"}>{statusLabel(c.status)}</Badge>
        <span className="flex gap-1"><Badge tone="accent">{formatLabel(c.format)}</Badge><PillarChip id={c.pillar} /></span>
      </div>
    </Link>
  );
}
