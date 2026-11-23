import { useState } from "react";
import { Badge, Button, Card, ConfirmButton, PageHeader, SectionTitle } from "../components/ui";
import { formatNL } from "../domain/dates";
import { PILLAR_LABELS } from "../domain/profile";
import type { EventType, PillarId, SeasonalEvent } from "../domain/types";
import { useStore } from "../state/store";


export default function SettingsPage() {
  const s = useStore();
  const c = s.creator;
  const field = "mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm";

  return (
    <>
      <PageHeader kicker="Instellingen" title={`${c.name} ${c.handle}`} />

      <SectionTitle>Contentpijlers</SectionTitle>
      <Card className="space-y-3">
        <p className="text-xs text-muted">Hoe belangrijk is elke pijler? 0 = uit. Dit stuurt relevantie, ideeën en de maandplanning.</p>
        {c.pillars.map((p) => (
          <label key={p.id} className="block text-sm">
            <span className="flex justify-between"><span>{p.label}</span><span className="tabular text-muted">{Math.round(p.weight * 100)}%</span></span>
            <input type="range" min={0} max={1} step={0.1} value={p.weight} className="w-full accent-[var(--color-accent)]"
              onChange={(e) => s.updateCreator({ pillars: c.pillars.map((x) => (x.id === p.id ? { ...x, weight: Number(e.target.value) } : x)) })} />
          </label>
        ))}
      </Card>

      <SectionTitle>Profiel</SectionTitle>
      <Card className="space-y-3">
        <label className="block text-sm">Beschikbare productietijd (uur per week)
          <input type="number" min={1} max={60} className={field} value={c.hoursPerWeek} onChange={(e) => s.updateCreator({ hoursPerWeek: Math.max(1, Number(e.target.value)) })} />
        </label>
        <label className="block text-sm">Merkstem<textarea rows={3} className={field} value={c.brandVoice} onChange={(e) => s.updateCreator({ brandVoice: e.target.value })} /></label>
        <label className="block text-sm">Doelgroep<textarea rows={2} className={field} value={c.audience} onChange={(e) => s.updateCreator({ audience: e.target.value })} /></label>
        <label className="block text-sm">Regio
          <select className={field} value={c.region} onChange={(e) => s.updateCreator({ region: e.target.value as typeof c.region })}>
            <option value="NL">Heel Nederland</option><option value="NL-noord">Noord</option><option value="NL-midden">Midden</option><option value="NL-zuid">Zuid</option>
          </select>
        </label>
        <label className="block text-sm">Onderwerpen die je niet wilt (komma-gescheiden)
          <input className={field} value={c.blockedTopics.join(", ")} placeholder="bijv. alcohol, weegschaal"
            onChange={(e) => s.updateCreator({ blockedTopics: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
        </label>
      </Card>

      <SectionTitle>Seizoensmeldingen</SectionTitle>
      <Card className="space-y-3 text-sm">
        <label className="flex items-center justify-between">Meldingen aan
          <input type="checkbox" checked={c.notifications.enabled} onChange={(e) => s.updateCreator({ notifications: { ...c.notifications, enabled: e.target.checked } })} />
        </label>
        <label className="block">Maximaal per week: {c.notifications.maxPerWeek}
          <input type="range" min={1} max={10} value={c.notifications.maxPerWeek} className="w-full accent-[var(--color-accent)]"
            onChange={(e) => s.updateCreator({ notifications: { ...c.notifications, maxPerWeek: Number(e.target.value) } })} />
        </label>
        <label className="block">Alleen momenten met relevantie ≥ {c.notifications.minRelevance}%
          <input type="range" min={0} max={95} step={5} value={c.notifications.minRelevance} className="w-full accent-[var(--color-accent)]"
            onChange={(e) => s.updateCreator({ notifications: { ...c.notifications, minRelevance: Number(e.target.value) } })} />
        </label>
        <div>
          <div className="mb-1">Fases en voorbereidingstijd (dagen vooraf)</div>
          {c.prepDefaults.map((st) => (
            <div key={st.id} className="flex items-center gap-2 py-1">
              <input type="checkbox" checked={c.notifications.stages.includes(st.id)} aria-label={`Meldingen voor ${st.label}`}
                onChange={(e) => s.updateCreator({ notifications: { ...c.notifications, stages: e.target.checked ? [...c.notifications.stages, st.id] : c.notifications.stages.filter((x) => x !== st.id) } })} />
              <span className="flex-1">{st.label}</span>
              <input type="number" min={0} max={120} value={st.daysBefore} disabled={st.id === "dag_zelf"} aria-label={`Dagen vooraf voor ${st.label}`}
                className="w-16 rounded-lg border border-line bg-paper px-2 py-1 text-right tabular"
                onChange={(e) => s.updateCreator({ prepDefaults: c.prepDefaults.map((x) => (x.id === st.id ? { ...x, daysBefore: Number(e.target.value) } : x)) })} />
            </div>
          ))}
          <p className="text-xs text-muted">Grote momenten (zoals januari) kunnen een eigen, langere termijn hebben.</p>
        </div>
        {c.mutedEventIds.length > 0 && (
          <div>
            <div className="mb-1">Uitgezette momenten</div>
            <div className="flex flex-wrap gap-1.5">
              {c.mutedEventIds.map((id) => (
                <button key={id} onClick={() => s.updateCreator({ mutedEventIds: c.mutedEventIds.filter((x) => x !== id) })}>
                  <Badge>{s.events.find((e) => e.id === id)?.name ?? id} ✕</Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <SectionTitle>Eigen momenten & trends</SectionTitle>
      <CustomEvents />

      <SectionTitle>Gegevens</SectionTitle>
      <Card className="text-sm">
        <p className="text-muted">MVP: je planning wordt lokaal in deze browser bewaard. Geen account, geen cloud-opslag.</p>
        <ConfirmButton className="mt-2" question="Alle planning, swipes en instellingen wissen?" onConfirm={s.reset}>Alles wissen</ConfirmButton>
      </Card>
    </>
  );
}

function CustomEvents() {
  const s = useStore();
  const [f, setF] = useState({
    name: "", type: "persoonlijk" as EventType, start: s.today, end: s.today, yearly: false,
    pillars: [] as PillarId[], sourceUrl: "", establishedAt: s.today, expiresAt: "",
  });
  const isTrend = f.type === "trend";
  const valid = f.name.trim() && f.start && f.end >= f.start && f.pillars.length > 0 &&
    (!isTrend || (/^https?:\/\//.test(f.sourceUrl) && f.establishedAt && f.expiresAt >= f.start));

  const add = () => {
    const id = `eigen-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${f.start}`;
    const [, mm, dd] = f.start.split("-").map(Number);
    const ev: SeasonalEvent = {
      id, name: f.name.trim(), type: f.type, region: s.creator.region,
      dateKind: isTrend ? "trend" : "verified",
      rule: !isTrend && f.yearly
        ? { kind: "fixed", month: mm, day: dd }
        : { kind: "explicit", occurrences: [{ start: f.start, end: f.end, verifiedAt: s.today }] },
      pillarFit: Object.fromEntries(f.pillars.map((p) => [p, 1])),
      audiences: [], contentCategories: [],
      source: isTrend ? { label: "Door jou vastgesteld", url: f.sourceUrl } : { label: "Eigen moment" },
      lastVerified: isTrend ? f.establishedAt : s.today,
      expiresAt: isTrend ? f.expiresAt : undefined,
      weight: 2,
    };
    if (!isTrend && f.yearly) ev.dateKind = "fixed";
    s.addCustomEvent(ev);
    setF({ ...f, name: "" });
  };
  const field = "mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm";

  return (
    <Card className="space-y-3 text-sm">
      {s.customEvents.length > 0 && (
        <ul className="space-y-1">
          {s.customEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between">
              <span>{e.name} <span className="text-xs text-muted">· {e.type}{e.expiresAt ? ` · verloopt ${formatNL(e.expiresAt)}` : ""}</span></span>
              <Button variant="danger" onClick={() => s.removeCustomEvent(e.id)}>Verwijder</Button>
            </li>
          ))}
        </ul>
      )}
      <label className="block">Naam<input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="bijv. Verjaardag dochter, 25 kg eraf" /></label>
      <label className="block">Soort
        <select className={field} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as EventType })}>
          <option value="persoonlijk">Persoonlijk (verjaardag, mijlpaal, vakantie, campagne)</option>
          <option value="sport">Sportevenement</option>
          <option value="niche">Niche-inhaker</option>
          <option value="trend">Actuele trend (bron verplicht)</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">Van<input type="date" className={field} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: e.target.value > f.end ? e.target.value : f.end })} /></label>
        <label className="block">Tot en met<input type="date" className={field} value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
      </div>
      {!isTrend && (
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.yearly} onChange={(e) => setF({ ...f, yearly: e.target.checked })} /> Elk jaar op deze datum</label>
      )}
      {isTrend && (
        <div className="rounded-xl bg-warn-soft p-3">
          <p className="text-xs text-warn">ContentFlow verzint geen trends. Voeg een controleerbare bron toe; na de vervaldatum verdwijnt de trend.</p>
          <label className="mt-2 block">Bron (URL)<input className={field} value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://…" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">Vastgesteld op<input type="date" className={field} value={f.establishedAt} onChange={(e) => setF({ ...f, establishedAt: e.target.value })} /></label>
            <label className="block">Verloopt op<input type="date" className={field} value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></label>
          </div>
        </div>
      )}
      <div>
        <div>Past bij</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {(Object.keys(PILLAR_LABELS) as PillarId[]).map((p) => (
            <button key={p} onClick={() => setF({ ...f, pillars: f.pillars.includes(p) ? f.pillars.filter((x) => x !== p) : [...f.pillars, p] })}
              className={`rounded-full border px-2.5 py-1 text-xs ${f.pillars.includes(p) ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
              {PILLAR_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <Button onClick={add} disabled={!valid}>Toevoegen</Button>
    </Card>
  );
}
