// Samenwerkingen: deadlines, exclusiviteitsconflicten en overzicht. Alleen signaleren;
// beslissingen (accepteren, afwijzen, verschuiven) neemt de creator zelf.
import { addDays, diffDays, formatNL } from "./dates";
import type { ContentItem, Deal, ISODate } from "./types";

const OPEN: Deal["status"][] = ["aanbod", "onderhandeling", "akkoord", "content_ingediend"];
const ACTIVE: Deal["status"][] = ["akkoord", "content_ingediend", "live"];

export const PLATFORM_LABELS: Record<Deal["platform"], string> = {
  influentials: "Influentials",
  join: "Join",
  direct: "Direct",
  anders: "Anders",
};

export interface DealSignal {
  id: string;
  dealId: string;
  severity: "info" | "let_op";
  title: string;
  detail: string;
}

export function dealSignals(deals: Deal[], content: ContentItem[], today: ISODate): DealSignal[] {
  const out: DealSignal[] = [];
  for (const d of deals) {
    // Deadline voor aanleveren nadert of is verstreken.
    if (d.contentDeadline && (d.status === "akkoord" || d.status === "onderhandeling")) {
      const days = diffDays(today, d.contentDeadline);
      if (days < 0) {
        out.push({ id: `deadline-voorbij:${d.id}`, dealId: d.id, severity: "let_op", title: `${d.brand}: deadline verstreken`, detail: `De content had op ${formatNL(d.contentDeadline)} aangeleverd moeten zijn.` });
      } else if (days <= 5) {
        out.push({ id: `deadline:${d.id}`, dealId: d.id, severity: "let_op", title: `${d.brand}: nog ${days} dag${days === 1 ? "" : "en"}`, detail: `Content aanleveren uiterlijk ${formatNL(d.contentDeadline)}.` });
      }
    }
    // Akkoord, maar nog geen content gekoppeld.
    if (d.status === "akkoord" && !content.some((c) => c.dealId === d.id)) {
      out.push({ id: `geen-content:${d.id}`, dealId: d.id, severity: "info", title: `${d.brand}: nog geen content gepland`, detail: "Maak een contentitem aan en plan een opnamedag." });
    }
    // Aanbod staat lang open.
    if (d.status === "aanbod" && diffDays(d.createdAt.slice(0, 10), today) >= 3) {
      out.push({ id: `open:${d.id}`, dealId: d.id, severity: "info", title: `${d.brand}: aanbod wacht op reactie`, detail: "Snel reageren vergroot je kans op de deal." });
    }
  }
  out.push(...exclusivityConflicts(deals));
  return out;
}

/**
 * Conflict: deal A heeft exclusiviteit voor categorie X tot datum T, en deal B (ander merk,
 * zelfde categorie) gaat live vóór of op T. Afgewezen deals tellen niet mee.
 */
export function exclusivityConflicts(deals: Deal[]): DealSignal[] {
  const out: DealSignal[] = [];
  const live = deals.filter((d) => d.status !== "afgewezen");
  for (const a of live) {
    if (!a.exclusivity || !ACTIVE.concat(OPEN).includes(a.status)) continue;
    const cat = a.exclusivity.category.trim().toLowerCase();
    if (!cat) continue;
    const from = a.liveDate ?? a.createdAt.slice(0, 10);
    for (const b of live) {
      if (b.id === a.id || b.brand.trim().toLowerCase() === a.brand.trim().toLowerCase()) continue;
      if (b.category.trim().toLowerCase() !== cat) continue;
      const bDate = b.liveDate ?? b.contentDeadline;
      if (!bDate || bDate < addDays(from, -30) || bDate > a.exclusivity.until) continue;
      out.push({
        id: `excl:${a.id}:${b.id}`,
        dealId: b.id,
        severity: "let_op",
        title: `Mogelijk conflict: ${b.brand} en ${a.brand}`,
        detail: `${a.brand} heeft exclusiviteit voor “${a.exclusivity.category}” t/m ${formatNL(a.exclusivity.until, { year: true })}; ${b.brand} (zelfde categorie) staat op ${formatNL(bDate)}. Check je contract.`,
      });
    }
  }
  return out;
}

export function dealTotals(deals: Deal[]) {
  const sum = (ds: Deal[]) => ds.reduce((s, d) => s + (d.feeEUR ?? 0), 0);
  return {
    pipeline: sum(deals.filter((d) => d.status === "aanbod" || d.status === "onderhandeling")),
    bevestigd: sum(deals.filter((d) => ["akkoord", "content_ingediend", "live", "gefactureerd"].includes(d.status))),
    betaald: sum(deals.filter((d) => d.status === "betaald")),
  };
}

export const formatEUR = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
