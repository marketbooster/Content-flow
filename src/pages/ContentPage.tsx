import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type HookResult } from "../api";
import { BriefingEditor } from "../components/BriefingEditor";
import { Button, Card, ConfirmButton, Empty, LinkButton, PageHeader, SectionTitle } from "../components/ui";
import { PILLAR_LABELS } from "../domain/profile";
import { defaultLocation } from "../domain/shoot";
import { CONTENT_STATUSES, SHOOT_LOCATIONS, type ContentFormat, type PillarId, type ShootLocation } from "../domain/types";
import { useStore } from "../state/store";

const FORMATS: ContentFormat[] = ["reel", "tiktok", "carrousel", "story", "post", "live", "blog"];

export default function ContentPage() {
  const { id = "" } = useParams();
  const s = useStore();
  const navigate = useNavigate();
  const c = s.content.find((x) => x.id === id);
  if (!c) return <Empty>Contentitem niet gevonden.</Empty>;
  const occ = c.eventKey ? s.occurrences.find((o) => o.key === c.eventKey) : undefined;
  const ev = occ && s.events.find((e) => e.id === occ.eventId);
  const deal = c.dealId ? s.deals.find((d) => d.id === c.dealId) : undefined;
  const set = (patch: Parameters<typeof s.updateContent>[1]) => s.updateContent(c.id, patch);
  const field = "mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm";
  const stepIndex = CONTENT_STATUSES.findIndex((x) => x.id === c.status);

  return (
    <>
      <button onClick={() => navigate(-1)} className="text-sm text-muted">← Terug</button>
      <PageHeader kicker="Contentitem" title={c.title}
        sub={<>
          {ev && <Link className="text-accent" to={`/moment/${encodeURIComponent(occ!.key)}`}>{ev.name}</Link>}
          {ev && deal && " · "}
          {deal && <Link className="text-accent" to="/deals">Deal met {deal.brand}</Link>}
        </>} />

      {/* Productiestappen */}
      <ol className="mb-4 flex gap-1" aria-label="Productiestatus">
        {CONTENT_STATUSES.map((st, i) => (
          <li key={st.id} className="flex-1">
            <button onClick={() => set({ status: st.id })} aria-current={c.status === st.id}
              className={`w-full rounded-full px-1 py-1.5 text-[11px] font-semibold sm:text-xs ${i <= stepIndex ? "btn-gradient" : "border border-line bg-card text-muted"}`}>
              {st.label}
            </button>
          </li>
        ))}
      </ol>

      {c.needsNutritionCalc && (
        <Card className="mb-3 border-warn/40 bg-warn-soft text-sm">Voedingswaarden nog berekenen uit de echte ingrediënten vóór publicatie. Calorie-doelen in de titel zijn doelen, geen feiten.</Card>
      )}

      <Card className="space-y-3">
        <label className="block text-sm">Titel<input id="c-title" className={field} value={c.title} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className="block text-sm">Hook<input id="c-hook" className={field} value={c.hook ?? ""} onChange={(e) => set({ hook: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Publicatiedatum<input id="c-date" type="date" className={field} value={c.date ?? ""} onChange={(e) => set({ date: e.target.value || undefined })} /></label>
          <label className="block text-sm">Opnamelocatie
            <select id="c-location" className={field} value={defaultLocation(c)} onChange={(e) => set({ location: e.target.value as ShootLocation })}>
              {SHOOT_LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Format
            <select id="c-format" className={field} value={c.format} onChange={(e) => set({ format: e.target.value as ContentFormat })}>
              {FORMATS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="block text-sm">Pijler
            <select id="c-pillar" className={field} value={c.pillar} onChange={(e) => set({ pillar: e.target.value as PillarId })}>
              {Object.entries(PILLAR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="col-span-2 block text-sm">Samenwerking
            <select id="c-deal" className={field} value={c.dealId ?? ""} onChange={(e) => set({ dealId: e.target.value || undefined })}>
              <option value="">Geen</option>
              {s.deals.filter((d) => d.status !== "afgewezen").map((d) => <option key={d.id} value={d.id}>{d.brand}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">Product- of actielink
          <span className="flex gap-2">
            <input id="c-link" type="url" className={field} value={c.link ?? ""} placeholder="https://…" onChange={(e) => set({ link: e.target.value || undefined })} />
            {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="mt-1 shrink-0 self-center text-sm font-semibold text-accent">Open ↗</a>}
          </span>
        </label>
        <label className="block text-sm">Omschrijving<textarea id="c-desc" rows={3} className={field} value={c.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></label>
        <label className="block text-sm">Script<textarea id="c-script" rows={6} className={field} value={c.script ?? ""} onChange={(e) => set({ script: e.target.value })} /></label>
        <label className="block text-sm">Shotlist (één per regel)
          <textarea id="c-shots" rows={4} className={field} value={(c.shotlist ?? []).join("\n")} onChange={(e) => set({ shotlist: e.target.value.split("\n") })} />
        </label>
        {(c.hashtags?.length ?? 0) > 0 && <p className="text-sm text-accent">{c.hashtags!.join(" ")}</p>}
      </Card>

      <BriefingEditor item={c} />

      <HookGenerator itemId={c.id} />

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton to={`/studio?content=${c.id}`} variant="primary">{c.script ? "Opnieuw uitwerken met AI" : "Script & shotlist met AI"}</LinkButton>
        <ConfirmButton question="Dit item verwijderen?" onConfirm={() => { s.removeContent(c.id); navigate("/kalender"); }}>Verwijderen</ConfirmButton>
      </div>
    </>
  );
}

function HookGenerator({ itemId }: { itemId: string }) {
  const s = useStore();
  const c = s.content.find((x) => x.id === itemId)!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<HookResult | null>(null);
  const [copied, setCopied] = useState(false);
  const preview = Boolean(import.meta.env.VITE_PREVIEW);

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      setRes(await api.hooks({
        creator: { name: s.creator.name, brandVoice: s.creator.brandVoice, audience: s.creator.audience, pillars: s.creator.pillars.filter((p) => p.weight > 0).map((p) => p.label) },
        item: { title: c.title, hook: c.hook, description: c.description, format: c.format, pillar: c.pillar },
      }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyCaption = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* kopiëren niet toegestaan */ }
  };

  return (
    <>
      <SectionTitle>Hook-generator</SectionTitle>
      <Card>
        <p className="text-sm text-muted">5 alternatieve hooks, een caption en hashtags in jouw merkstem. Eén snelle AI-aanroep (± $0,05).</p>
        {preview ? (
          <p className="mt-2 text-sm text-warn">In deze preview zonder server werkt AI niet. Op je eigen ContentFlow-adres wel.</p>
        ) : (
          <Button className="mt-3" onClick={run} disabled={busy}>{busy ? "Bezig…" : res ? "↻ Nieuwe hooks" : "✨ Genereer hooks"}</Button>
        )}
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        {res && (
          <div className="mt-4 space-y-2">
            {res.hooks.map((h, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-line p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">“{h.hook}”</div>
                  <div className="text-xs text-muted">{h.angle}</div>
                </div>
                <Button variant={c.hook === h.hook ? "secondary" : "primary"} onClick={() => s.updateContent(c.id, { hook: h.hook, hooks: res.hooks.map((x) => x.hook) })}>
                  {c.hook === h.hook ? "✓ Gekozen" : "Kies"}
                </Button>
              </div>
            ))}
            <div className="rounded-xl bg-paper p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Caption</div>
              <p className="whitespace-pre-wrap">{res.caption}</p>
              <p className="mt-2 text-accent">{res.hashtags.join(" ")}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" onClick={() => copyCaption(`${res.caption}\n\n${res.hashtags.join(" ")}`)}>{copied ? "✓ Gekopieerd" : "Kopieer"}</Button>
                <Button variant="secondary" onClick={() => s.updateContent(c.id, { hashtags: res.hashtags, script: `${c.script ? c.script + "\n\n" : ""}Caption:\n${res.caption}` })}>Bewaar bij item</Button>
              </div>
            </div>
            {res.notes.length > 0 && <ul className="list-disc pl-5 text-xs text-muted">{res.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            <p className="text-[11px] text-muted">{res.model} · ${res.costUSD.toFixed(3)}{res.cached ? " · uit cache" : ""} · niet geverifieerd</p>
          </div>
        )}
      </Card>
    </>
  );
}
