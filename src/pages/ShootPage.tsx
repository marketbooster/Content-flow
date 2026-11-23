import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, ConfirmButton, Empty, PageHeader, PillarChip, SectionTitle, formatLabel } from "../components/ui";
import { addDays, formatNL, weekday } from "../domain/dates";
import { defaultLocation, filmMinutes, planShoot, SETUP_MINUTES } from "../domain/shoot";
import { SHOOT_LOCATIONS, type ContentItem, type ShootLocation } from "../domain/types";
import { useStore } from "../state/store";

const locInfo = (l: ShootLocation) => SHOOT_LOCATIONS.find((x) => x.id === l)!;
const hours = (m: number) => `${Math.floor(m / 60)}u${m % 60 ? ` ${m % 60}m` : ""}`;

export default function ShootPage() {
  const s = useStore();
  const [params, setParams] = useSearchParams();
  const openId = params.get("dag");
  const open = s.shootDays.find((d) => d.id === openId);
  const upcoming = [...s.shootDays].filter((d) => d.date >= s.today).sort((a, b) => a.date.localeCompare(b.date));

  if (open) return <ShootDayView id={open.id} onBack={() => setParams({})} />;

  return (
    <>
      <PageHeader kicker="Batch filmen" title="Opnamedag" sub="Kies een dag en hoeveel tijd je hebt. ContentFlow bundelt je video's per locatie, zodat je minder hoeft om te bouwen." />
      {upcoming.length > 0 && (
        <>
          <SectionTitle>Geplande opnamedagen</SectionTitle>
          <ul className="space-y-2">
            {upcoming.map((d) => (
              <li key={d.id}>
                <button onClick={() => setParams({ dag: d.id })} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left hover:border-accent/50">
                  <span className="text-2xl" aria-hidden>🎬</span>
                  <span className="flex-1"><b>{formatNL(d.date, { weekday: true })}</b><br /><span className="text-sm text-muted">{d.contentIds.length} video's · {hours(d.minutesAvailable)} beschikbaar</span></span>
                  <span className="text-sm font-semibold text-accent">Draaiboek →</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <NewShootDay onCreated={(id) => setParams({ dag: id })} />
    </>
  );
}

function nextSaturday(today: string) {
  const wd = weekday(today);
  return addDays(today, ((6 - wd + 7) % 7) || 7);
}

function NewShootDay({ onCreated }: { onCreated: (id: string) => void }) {
  const s = useStore();
  const [date, setDate] = useState(nextSaturday(s.today));
  const [minutes, setMinutes] = useState(180);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<string[]>([]);

  const pool = s.content.filter((c) => !excluded.has(c.id));
  const plan = useMemo(() => planShoot(pool, date, minutes, added), [pool, date, minutes, added]);
  const chosen = plan.groups.flatMap((g) => g.items);

  return (
    <>
      <SectionTitle>Nieuwe opnamedag</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="block">Datum
            <input id="shoot-date" type="date" min={s.today} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" />
          </label>
          <label className="block">Beschikbare tijd
            <select id="shoot-minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2">
              {[90, 120, 180, 240, 300, 360].map((m) => <option key={m} value={m}>{hours(m)}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">Filmtijd ≈ 60% van de productietijd per video, plus {SETUP_MINUTES} min opbouw per locatie. De rest (bewerken) doe je later.</p>
      </Card>

      {chosen.length === 0 ? (
        <div className="mt-3"><Empty>Geen video's die vóór hun publicatiedatum gefilmd moeten worden. Plan eerst ideeën via Swipe of de maandplanning.</Empty></div>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span><b>{chosen.length} video's</b> · {hours(plan.totalMinutes)} van {hours(minutes)}</span>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand" style={{ width: `${Math.min(100, (plan.totalMinutes / minutes) * 100)}%` }} /></div>
          </div>
          {plan.groups.map((g) => (
            <Card key={g.location} className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-sans font-semibold">{locInfo(g.location).emoji} {locInfo(g.location).label}</h3>
                <span className="text-xs text-muted tabular">± {hours(g.minutes)}</span>
              </div>
              <ul className="space-y-1.5">
                {g.items.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted">{c.date ? `live ${formatNL(c.date)}` : "geen datum"}</span>
                    <button onClick={() => { setExcluded(new Set([...excluded, c.id])); setAdded(added.filter((x) => x !== c.id)); }} className="text-xs text-muted hover:text-danger" aria-label={`${c.title} weghalen`}>✕</button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {plan.leftover.length > 0 && (
            <details className="mt-3 rounded-2xl border border-line bg-card p-3 text-sm">
              <summary className="cursor-pointer">{plan.leftover.length} video's passen niet meer</summary>
              <ul className="mt-2 space-y-1">
                {plan.leftover.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate">{c.title}</span>
                    <button className="text-xs font-semibold text-accent" onClick={() => setAdded([...added, c.id])}>Toch meenemen</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Button className="mt-4 w-full" onClick={() => onCreated(s.saveShootDay({ date, minutesAvailable: minutes, contentIds: chosen.map((c) => c.id) }))}>
            🎬 Opnamedag opslaan
          </Button>
        </>
      )}
      {excluded.size > 0 && <Button variant="ghost" className="mt-2" onClick={() => setExcluded(new Set())}>Weggehaalde video's terugzetten</Button>}
    </>
  );
}

function ShootDayView({ id, onBack }: { id: string; onBack: () => void }) {
  const s = useStore();
  const day = s.shootDays.find((d) => d.id === id)!;
  const items = day.contentIds.map((cid) => s.content.find((c) => c.id === cid)).filter((c): c is ContentItem => Boolean(c));
  const groups = new Map<ShootLocation, ContentItem[]>();
  for (const c of items) {
    const l = defaultLocation(c);
    groups.set(l, [...(groups.get(l) ?? []), c]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const done = items.filter((c) => c.status !== "idee" && c.status !== "script").length;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  return (
    <>
      <button onClick={onBack} className="text-sm text-muted">← Opnamedagen</button>
      <PageHeader kicker="Draaiboek" title={formatNL(day.date, { weekday: true })}
        sub={`${items.length} video's · ${done} gefilmd · ${ordered.length} locatie${ordered.length === 1 ? "" : "s"}`} />
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div>

      {ordered.map(([loc, list], gi) => (
        <section key={loc} className="mb-5">
          <h2 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-muted">
            Blok {gi + 1} · {locInfo(loc).emoji} {locInfo(loc).label}
          </h2>
          <div className="space-y-2">
            {list.map((c) => {
              const filmed = c.status !== "idee" && c.status !== "script";
              return (
                <Card key={c.id} className={filmed ? "opacity-60" : ""}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/content/${c.id}`} className="font-semibold hover:text-accent">{c.title}</Link>
                      {c.hook && <p className="mt-0.5 text-sm italic text-plum">“{c.hook}”</p>}
                      <div className="mt-1.5 flex flex-wrap gap-1"><Badge tone="accent">{formatLabel(c.format)}</Badge><PillarChip id={c.pillar} /><Badge>± {filmMinutes(c)} min</Badge></div>
                    </div>
                    <Button variant={filmed ? "secondary" : "primary"} onClick={() => s.updateContent(c.id, { status: filmed ? "script" : "gefilmd" })}>
                      {filmed ? "↶" : "✓ Gefilmd"}
                    </Button>
                  </div>
                  {(c.shotlist?.filter(Boolean).length ?? 0) > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm">
                      {c.shotlist!.filter(Boolean).map((shot, i) => {
                        const k = `${c.id}:${i}`;
                        return (
                          <li key={k}>
                            <label className="flex items-start gap-2">
                              <input type="checkbox" checked={!!checked[k]} onChange={(e) => setChecked({ ...checked, [k]: e.target.checked })} className="mt-1 accent-[var(--color-accent)]" />
                              <span className={checked[k] ? "text-muted line-through" : ""}>{shot}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted">Nog geen shotlist. <Link className="font-semibold text-accent" to={`/studio?content=${c.id}`}>Laat AI er een maken →</Link></p>
                  )}
                  <label className="mt-3 flex items-center gap-2 text-xs text-muted">Locatie
                    <select value={defaultLocation(c)} onChange={(e) => s.updateContent(c.id, { location: e.target.value as ShootLocation })} className="rounded-lg border border-line bg-paper px-2 py-1">
                      {SHOOT_LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </label>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => s.updateManyContent(items.filter((c) => c.status === "idee" || c.status === "script").map((c) => c.id), { status: "gefilmd" })} disabled={done === items.length}>
          Alles gefilmd ✓
        </Button>
        <ConfirmButton question="Opnamedag verwijderen? (je content blijft bestaan)" onConfirm={() => { s.removeShootDay(day.id); onBack(); }}>Verwijderen</ConfirmButton>
      </div>
    </>
  );
}
