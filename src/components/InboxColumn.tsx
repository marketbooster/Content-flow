// Kolom "Binnen" op het productiebord: tips van je geplande taken, met snelle acties.
import { useState } from "react";
import { formatNL } from "../domain/dates";
import type { ContentItem } from "../domain/types";
import { type InboxItem, type InboxSource, SOURCE_INFO, useInbox } from "../state/inbox";
import { useStore } from "../state/store";
import { Badge } from "./ui";

const PILLAR: Record<InboxSource, ContentItem["pillar"]> = {
  metapic: "samenwerkingen", hema: "samenwerkingen", voorraad: "samenwerkingen",
  lowkcal: "recepten", samenwerking: "samenwerkingen", anders: "samenwerkingen",
};

function describe(i: InboxItem): string {
  return [
    [i.store, i.price, i.discount].filter(Boolean).join(" · "),
    i.why,
    i.details,
    i.validUntil ? `Geldig t/m ${formatNL(i.validUntil, { year: true })}` : null,
    i.url ? `Link: ${i.url}` : null,
    i.source === "metapic" || i.source === "hema" || i.source === "voorraad" ? "Zet de link eerst om in de Metapic-app naar je eigen link." : null,
  ].filter(Boolean).join("\n");
}

export function InboxColumn() {
  const s = useStore();
  const { fresh, configured, error, preview, setStatus } = useInbox();
  const [filter, setFilter] = useState<InboxSource | "alle">("alle");
  const sources = [...new Set(fresh.map((i) => i.source))];
  const list = fresh.filter((i) => filter === "alle" || i.source === filter);

  const toIdea = (i: InboxItem) => {
    s.addContent([{
      title: i.store && !i.title.toLowerCase().includes(i.store.toLowerCase()) ? `${i.store}: ${i.title}` : i.title,
      hook: i.idea, description: describe(i), link: i.url, pillar: PILLAR[i.source], format: "reel", status: "idee", source: "inbox",
    }]);
    setStatus(i.id, "opgepakt");
  };
  const toDeal = (i: InboxItem) => {
    s.saveDeal({
      brand: i.store || i.title, platform: "direct", status: "aanbod", deliverables: "", category: "",
      notes: [i.title, i.why, i.details].filter(Boolean).join("\n"), link: i.url,
    });
    setStatus(i.id, "opgepakt");
  };

  return (
    <section aria-label="Binnen" className="w-[85vw] max-w-sm shrink-0 snap-start rounded-2xl border border-accent/40 bg-accent-soft/60 p-2 md:w-auto md:max-w-none">
      <h2 className="flex items-center justify-between px-1 pb-2 font-sans text-sm font-semibold">
        📥 Binnen <span className="rounded-full bg-card px-2 text-xs text-muted tabular">{fresh.length}</span>
      </h2>
      {sources.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1 px-1">
          {(["alle", ...sources] as const).map((src) => (
            <button key={src} onClick={() => setFilter(src)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${filter === src ? "btn-gradient" : "bg-card text-muted"}`}>
              {src === "alle" ? "Alle" : `${SOURCE_INFO[src].emoji} ${SOURCE_INFO[src].label}`}
            </button>
          ))}
        </div>
      )}
      <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
        {preview && <li className="rounded-xl bg-card p-3 text-xs text-muted">In de preview zonder server zie je hier geen tips. Op je eigen ContentFlow-adres wel.</li>}
        {!preview && error && <li className="rounded-xl bg-card p-3 text-xs text-danger">{error}</li>}
        {!preview && configured === false && (
          <li className="rounded-xl bg-card p-3 text-xs text-muted">De inbox is nog niet aangezet. Voeg <code>INBOX_TOKEN</code> toe in Railway (zie docs/ONLINE-ZETTEN.md).</li>
        )}
        {!preview && configured && list.length === 0 && (
          <li className="rounded-xl border border-dashed border-line bg-card/50 p-3 text-center text-xs text-muted">Alles bekeken ✨ Nieuwe tips komen hier elke ochtend binnen.</li>
        )}
        {list.map((i) => (
          <li key={i.id} className="rounded-xl border border-line bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Badge tone="accent">{SOURCE_INFO[i.source].emoji} {SOURCE_INFO[i.source].label}</Badge>
              <span className="text-[11px] text-muted">{formatNL(i.receivedAt.slice(0, 10))}</span>
            </div>
            <div className="mt-1.5 font-medium leading-snug">{i.title}</div>
            {(i.store || i.price || i.discount) && (
              <div className="mt-0.5 text-xs text-muted">{[i.store, i.price, i.discount].filter(Boolean).join(" · ")}</div>
            )}
            {i.why && <div className="mt-1 text-xs">{i.why}</div>}
            {i.idea && <div className="mt-1 text-xs italic text-plum">💡 {i.idea}</div>}
            {i.validUntil && <div className="mt-1 text-[11px] font-semibold text-warn">t/m {formatNL(i.validUntil)}</div>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {i.source === "samenwerking" ? (
                <button onClick={() => toDeal(i)} className="btn-gradient rounded-full px-3 py-1 text-xs font-semibold">→ Deal</button>
              ) : (
                <button onClick={() => toIdea(i)} className="btn-gradient rounded-full px-3 py-1 text-xs font-semibold">→ Idee</button>
              )}
              {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-accent">Bekijk ↗</a>}
              <button onClick={() => setStatus(i.id, "afgewezen")} className="ml-auto text-xs text-muted hover:text-danger" aria-label={`${i.title} afwijzen`}>✕</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
