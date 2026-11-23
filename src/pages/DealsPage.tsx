import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, ConfirmButton, Empty, PageHeader, SectionTitle } from "../components/ui";
import { formatNL } from "../domain/dates";
import { dealSignals, dealTotals, formatEUR, PLATFORM_LABELS } from "../domain/deals";
import { DEAL_STATUSES, type Deal, type DealPlatform, type DealStatus } from "../domain/types";
import { useStore } from "../state/store";

type Draft = Omit<Deal, "id" | "createdAt"> & { id?: string };
const emptyDraft = (): Draft => ({
  brand: "", platform: "influentials", status: "aanbod", deliverables: "", category: "", notes: "",
});

const GROUPS: { title: string; statuses: DealStatus[] }[] = [
  { title: "Nieuw & in gesprek", statuses: ["aanbod", "onderhandeling"] },
  { title: "Bevestigd", statuses: ["akkoord", "content_ingediend", "live"] },
  { title: "Afronden", statuses: ["gefactureerd"] },
  { title: "Afgerond", statuses: ["betaald", "afgewezen"] },
];

const statusLabel = (s: DealStatus) => DEAL_STATUSES.find((x) => x.id === s)!.label;

export default function DealsPage() {
  const s = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const totals = dealTotals(s.deals);
  const signals = dealSignals(s.deals, s.content, s.today);

  if (draft) return <DealForm draft={draft} onClose={() => setDraft(null)} />;

  return (
    <>
      <PageHeader kicker="Creator Business" title="Samenwerkingen"
        action={<Button onClick={() => setDraft(emptyDraft())}>+ Deal</Button>} />

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="In gesprek" value={formatEUR(totals.pipeline)} />
        <Stat label="Bevestigd" value={formatEUR(totals.bevestigd)} />
        <Stat label="Betaald" value={formatEUR(totals.betaald)} />
      </div>

      {signals.length > 0 && (
        <div className="mt-4 space-y-2">
          {signals.map((x) => (
            <Card key={x.id} className={x.severity === "let_op" ? "border-warn/40 bg-warn-soft text-sm" : "text-sm"}>
              <b>{x.title}</b> · {x.detail}
            </Card>
          ))}
        </div>
      )}

      {s.deals.length === 0 && (
        <div className="mt-4"><Empty>Nog geen samenwerkingen. Voeg je eerste deal toe, bijvoorbeeld een campagne van Influentials of Join.</Empty></div>
      )}

      {GROUPS.map((g) => {
        const list = s.deals.filter((d) => g.statuses.includes(d.status))
          .sort((a, b) => (a.contentDeadline ?? a.liveDate ?? "9999").localeCompare(b.contentDeadline ?? b.liveDate ?? "9999"));
        if (list.length === 0) return null;
        return (
          <div key={g.title}>
            <SectionTitle>{g.title}</SectionTitle>
            <ul className="space-y-2">
              {list.map((d) => (
                <li key={d.id}>
                  <button onClick={() => setDraft(d)} className="w-full rounded-2xl border border-line bg-card p-4 text-left hover:border-accent/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{d.brand}</div>
                        <div className="text-sm text-muted">{d.deliverables || "Geen deliverables ingevuld"}</div>
                      </div>
                      {d.feeEUR ? <span className="font-display text-lg font-semibold tabular">{formatEUR(d.feeEUR)}</span> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="accent">{statusLabel(d.status)}</Badge>
                      <Badge>{PLATFORM_LABELS[d.platform]}</Badge>
                      {d.contentDeadline && <Badge tone="warn">Aanleveren {formatNL(d.contentDeadline)}</Badge>}
                      {d.liveDate && <Badge>Live {formatNL(d.liveDate)}</Badge>}
                      {d.exclusivity && <Badge tone="plum">Exclusief t/m {formatNL(d.exclusivity.until)}</Badge>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <SectionTitle>Nieuwe deals als eerste zien</SectionTitle>
      <Card className="text-sm">
        <p>Influentials en Join hebben geen openbare koppeling. De snelste route:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Zet <b>pushmeldingen</b> aan in de apps van Influentials en Join.</li>
          <li>Laat Claude je <b>mailbox</b> elk uur checken op nieuwe campagnemails en je een melding sturen (vraag dit in de chat).</li>
          <li>Interessante campagne? Tik op <b>+ Deal</b> en plak de link: deadlines en exclusiviteit worden dan bewaakt.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="font-semibold text-accent" href="https://www.influentials.com" target="_blank" rel="noreferrer">Influentials →</a>
          <a className="font-semibold text-accent" href="https://join.marketing" target="_blank" rel="noreferrer">Join →</a>
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-card p-3"><div className="text-muted">{label}</div><div className="mt-0.5 font-display text-base font-semibold tabular">{value}</div></div>;
}

function DealForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const s = useStore();
  const [d, setD] = useState<Draft>(draft);
  const [excl, setExcl] = useState(Boolean(draft.exclusivity));
  const field = "mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm";
  const linked = d.id ? s.content.filter((c) => c.dealId === d.id) : [];
  const valid = d.brand.trim().length > 0 && (!excl || (d.exclusivity?.category && d.exclusivity?.until));

  const save = () => {
    const id = s.saveDeal({ ...d, brand: d.brand.trim(), exclusivity: excl ? d.exclusivity : undefined });
    return id;
  };

  return (
    <>
      <button onClick={onClose} className="text-sm text-muted">← Samenwerkingen</button>
      <PageHeader kicker="Samenwerking" title={d.id ? d.brand : "Nieuwe deal"} />
      <Card className="space-y-3">
        <label className="block text-sm">Merk<input id="deal-brand" className={field} value={d.brand} onChange={(e) => setD({ ...d, brand: e.target.value })} placeholder="bijv. Body & Fit" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Platform
            <select id="deal-platform" className={field} value={d.platform} onChange={(e) => setD({ ...d, platform: e.target.value as DealPlatform })}>
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block text-sm">Status
            <select id="deal-status" className={field} value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as DealStatus })}>
              {DEAL_STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Vergoeding (€)
            <input id="deal-fee" type="number" min={0} inputMode="numeric" className={field} value={d.feeEUR ?? ""} onChange={(e) => setD({ ...d, feeEUR: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
          <label className="block text-sm">Productcategorie
            <input id="deal-category" className={field} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} placeholder="bijv. sportvoeding" />
          </label>
          <label className="block text-sm">Aanleveren uiterlijk
            <input id="deal-deadline" type="date" className={field} value={d.contentDeadline ?? ""} onChange={(e) => setD({ ...d, contentDeadline: e.target.value || undefined })} />
          </label>
          <label className="block text-sm">Live op
            <input id="deal-live" type="date" className={field} value={d.liveDate ?? ""} onChange={(e) => setD({ ...d, liveDate: e.target.value || undefined })} />
          </label>
        </div>
        <label className="block text-sm">Deliverables<input id="deal-deliverables" className={field} value={d.deliverables} onChange={(e) => setD({ ...d, deliverables: e.target.value })} placeholder="bijv. 1 reel + 3 stories" /></label>
        <label className="block text-sm">Link naar campagne<input id="deal-link" type="url" className={field} value={d.link ?? ""} onChange={(e) => setD({ ...d, link: e.target.value || undefined })} placeholder="https://…" /></label>
        <label className="flex items-center gap-2 text-sm"><input id="deal-excl" type="checkbox" checked={excl} onChange={(e) => setExcl(e.target.checked)} className="accent-[var(--color-accent)]" /> Exclusiviteit afgesproken</label>
        {excl && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-plum-soft p-3">
            <label className="block text-sm">Categorie
              <input id="deal-excl-cat" className={field} value={d.exclusivity?.category ?? d.category} onChange={(e) => setD({ ...d, exclusivity: { until: d.exclusivity?.until ?? "", category: e.target.value } })} />
            </label>
            <label className="block text-sm">Tot en met
              <input id="deal-excl-until" type="date" className={field} value={d.exclusivity?.until ?? ""} onChange={(e) => setD({ ...d, exclusivity: { category: d.exclusivity?.category ?? d.category, until: e.target.value } })} />
            </label>
          </div>
        )}
        <label className="block text-sm">Notities (briefing, voorwaarden)<textarea id="deal-notes" rows={4} className={field} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></label>
        <p className="text-xs text-muted">Let op reclameregels: label content als #ad / betaalde samenwerking.</p>
      </Card>

      {d.id && (
        <>
          <SectionTitle>Content voor deze deal</SectionTitle>
          {linked.length === 0 ? <Empty>Nog geen content gekoppeld.</Empty> : (
            <ul className="space-y-2">
              {linked.map((c) => <li key={c.id}><Link to={`/content/${c.id}`} className="block rounded-2xl border border-line bg-card p-3 text-sm font-medium">{c.title}</Link></li>)}
            </ul>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!valid} onClick={() => { save(); onClose(); }}>Opslaan</Button>
        <Button variant="secondary" disabled={!valid} onClick={() => {
          const id = save();
          s.addContent([{
            title: `${d.brand.trim()}: ${d.deliverables || "samenwerking"}`, pillar: "samenwerkingen", format: "reel", status: "idee",
            date: d.liveDate, dealId: id, source: "deal", description: d.notes,
          }]);
          setD({ ...d, id });
        }}>+ Content aanmaken</Button>
        {d.id && <ConfirmButton question="Deal verwijderen?" onConfirm={() => { s.removeDeal(d.id!); onClose(); }}>Verwijderen</ConfirmButton>}
      </div>
    </>
  );
}
