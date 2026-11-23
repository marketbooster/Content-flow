import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, Empty, LinkButton, PageHeader } from "../components/ui";
import { PILLAR_LABELS } from "../domain/profile";
import type { ContentFormat, ContentStatus, PillarId } from "../domain/types";
import { useStore } from "../state/store";

const STATUSES: ContentStatus[] = ["idee", "gepland", "in_productie", "klaar", "gepubliceerd"];
const FORMATS: ContentFormat[] = ["reel", "tiktok", "carrousel", "story", "post", "live", "blog"];

export default function ContentPage() {
  const { id = "" } = useParams();
  const s = useStore();
  const navigate = useNavigate();
  const c = s.content.find((x) => x.id === id);
  if (!c) return <Empty>Contentitem niet gevonden.</Empty>;
  const occ = c.eventKey ? s.occurrences.find((o) => o.key === c.eventKey) : undefined;
  const ev = occ && s.events.find((e) => e.id === occ.eventId);
  const set = (patch: Parameters<typeof s.updateContent>[1]) => s.updateContent(c.id, patch);
  const field = "mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm";

  return (
    <>
      <Link to="/kalender" className="text-sm text-muted">← Kalender</Link>
      <PageHeader kicker="Contentitem" title={c.title} sub={ev && <Link className="text-accent" to={`/moment/${encodeURIComponent(occ!.key)}`}>Gekoppeld aan {ev.name}</Link>} />
      {c.needsNutritionCalc && (
        <Card className="mb-3 border-warn/40 bg-warn-soft text-sm">Voedingswaarden nog berekenen uit de echte ingrediënten vóór publicatie. Calorie-doelen in de titel zijn doelen, geen feiten.</Card>
      )}
      <Card className="space-y-3">
        <label className="block text-sm">Titel<input className={field} value={c.title} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className="block text-sm">Hook<input className={field} value={c.hook ?? ""} onChange={(e) => set({ hook: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Datum<input type="date" className={field} value={c.date ?? ""} onChange={(e) => set({ date: e.target.value || undefined })} /></label>
          <label className="block text-sm">Status
            <select className={field} value={c.status} onChange={(e) => set({ status: e.target.value as ContentStatus })}>
              {STATUSES.map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}
            </select>
          </label>
          <label className="block text-sm">Format
            <select className={field} value={c.format} onChange={(e) => set({ format: e.target.value as ContentFormat })}>
              {FORMATS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="block text-sm">Pijler
            <select className={field} value={c.pillar} onChange={(e) => set({ pillar: e.target.value as PillarId })}>
              {Object.entries(PILLAR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">Omschrijving<textarea rows={3} className={field} value={c.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></label>
        <label className="block text-sm">Script<textarea rows={6} className={field} value={c.script ?? ""} onChange={(e) => set({ script: e.target.value })} /></label>
        <label className="block text-sm">Shotlist (één per regel)
          <textarea rows={4} className={field} value={(c.shotlist ?? []).join("\n")} onChange={(e) => set({ shotlist: e.target.value.split("\n") })} />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge>Bron: {c.source}</Badge>{c.productionMinutes && <Badge>± {c.productionMinutes} min</Badge>}
        </div>
      </Card>
      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton to={`/studio?content=${c.id}`} variant="primary">{c.script ? "Opnieuw uitwerken met AI" : "Script & shotlist met AI"}</LinkButton>
        <Button variant="danger" onClick={() => { if (confirm("Contentitem verwijderen?")) { s.removeContent(c.id); navigate("/kalender"); } }}>Verwijderen</Button>
      </div>
    </>
  );
}
