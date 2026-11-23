// Opnamedag-planner: bundelt content die nog gefilmd moet worden per locatie, zodat je in één
// sessie meerdere video's opneemt. Rekent met omkleed-/opbouwtijd per locatie.
import type { ContentItem, ISODate, ShootLocation } from "./types";

/** Opbouwtijd per locatiewissel (licht, statief, decor), in minuten. */
export const SETUP_MINUTES = 15;

/** Redelijke standaardlocatie als de creator er zelf nog geen koos. */
export function defaultLocation(c: Pick<ContentItem, "location" | "pillar" | "format" | "title">): ShootLocation {
  if (c.location) return c.location;
  const t = c.title.toLowerCase();
  if (/\b(boodschap|supermarkt|winkel|haul)/.test(t)) return "onderweg";
  if (/\b(wandel|hardloop|buiten|bbq|park)/.test(t)) return "buiten";
  if (/\b(sportschool|gym)\b/.test(t)) return "sportschool";
  switch (c.pillar) {
    case "recepten": return "keuken";
    case "fitness": return /\bthuis/.test(t) ? "thuis" : "sportschool";
    default: return "thuis";
  }
}

/** Kan dit item op `shootDate` gefilmd worden? */
export function isShootCandidate(c: ContentItem, shootDate: ISODate): boolean {
  if (c.status !== "idee" && c.status !== "script") return false;
  // Filmen op of vóór de publicatiedatum; zonder datum mag altijd.
  return !c.date || c.date >= shootDate;
}

export interface ShootGroup {
  location: ShootLocation;
  items: ContentItem[];
  minutes: number; // inclusief opbouw
}

export interface ShootPlan {
  groups: ShootGroup[];
  totalMinutes: number;
  leftover: ContentItem[]; // past niet meer in de beschikbare tijd
}

/**
 * Stelt een draaiboek voor: kandidaten op volgorde van publicatiedatum (eerst de urgentste),
 * gebundeld per locatie. Items die niet in de beschikbare tijd passen, komen in `leftover`.
 * Met `pinnedIds` kies je zelf welke items mee moeten (die gaan voor).
 */
export function planShoot(
  content: ContentItem[],
  shootDate: ISODate,
  minutesAvailable: number,
  pinnedIds?: string[],
): ShootPlan {
  const candidates = content.filter((c) => isShootCandidate(c, shootDate));
  const pinned = new Set(pinnedIds ?? []);
  const ordered = [...candidates].sort((a, b) => {
    const pa = pinned.has(a.id) ? 0 : 1;
    const pb = pinned.has(b.id) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.date ?? "9999") < (b.date ?? "9999") ? -1 : (a.date ?? "9999") > (b.date ?? "9999") ? 1 : 0;
  });

  const groups = new Map<ShootLocation, ShootGroup>();
  let used = 0;
  const leftover: ContentItem[] = [];
  for (const c of ordered) {
    const loc = defaultLocation(c);
    const film = filmMinutes(c);
    const extra = groups.has(loc) ? film : film + SETUP_MINUTES;
    if (used + extra > minutesAvailable && !pinned.has(c.id)) {
      leftover.push(c);
      continue;
    }
    const g = groups.get(loc) ?? { location: loc, items: [], minutes: SETUP_MINUTES };
    g.items.push(c);
    g.minutes += film;
    groups.set(loc, g);
    used += extra;
  }
  // Locaties met de meeste items eerst: minder wisselen aan het begin van de dag.
  const sorted = [...groups.values()].sort((a, b) => b.items.length - a.items.length);
  return { groups: sorted, totalMinutes: used, leftover };
}

/** Filmtijd ≈ 60% van de totale productietijd (de rest is bewerken). Minimaal 10 minuten. */
export function filmMinutes(c: Pick<ContentItem, "productionMinutes">): number {
  return Math.max(10, Math.round((c.productionMinutes ?? 60) * 0.6));
}
