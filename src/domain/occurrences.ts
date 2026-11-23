// Zet herhaalregels om in concrete voorkomens binnen een periode, met betrouwbaarheidsstatus.
import {
  addDays, daysInMonth, easterSunday, koningsdag, lastWeekday, nthWeekday, overlaps, ymd,
} from "./dates";
import type { EventOccurrence, ISODate, Reliability, SeasonalEvent } from "./types";

function span(start: ISODate, durationDays = 1): [ISODate, ISODate] {
  return [start, addDays(start, Math.max(1, durationDays) - 1)];
}

/** Voorkomens van één event in een bepaald jaar (op basis van de startdatum). */
export function occurrencesInYear(ev: SeasonalEvent, year: number): Omit<EventOccurrence, "reliability" | "key">[] {
  const r = ev.rule;
  const base = { eventId: ev.id, region: ev.region };
  switch (r.kind) {
    case "fixed": {
      const [start, end] = span(ymd(year, r.month, r.day), r.durationDays);
      return [{ ...base, start, end }];
    }
    case "month": {
      return [{ ...base, start: ymd(year, r.month, 1), end: ymd(year, r.month, daysInMonth(year, r.month)) }];
    }
    case "nthWeekday": {
      const d = addDays(nthWeekday(year, r.month, r.weekday, r.n), r.offsetDays ?? 0);
      const [start, end] = span(d, r.durationDays);
      return [{ ...base, start, end }];
    }
    case "lastWeekday": {
      const d = addDays(lastWeekday(year, r.month, r.weekday), r.offsetDays ?? 0);
      const [start, end] = span(d, r.durationDays);
      return [{ ...base, start, end }];
    }
    case "easter": {
      const [start, end] = span(addDays(easterSunday(year), r.offsetDays), r.durationDays);
      return [{ ...base, start, end }];
    }
    case "koningsdag": {
      const d = koningsdag(year);
      return [{ ...base, start: d, end: d }];
    }
    case "explicit": {
      return r.occurrences
        .filter((o) => Number(o.start.slice(0, 4)) === year)
        .map((o) => ({ ...base, start: o.start, end: o.end, region: o.region ?? ev.region }));
    }
  }
}

export function reliabilityOf(ev: SeasonalEvent, occ: { start: ISODate }, today: ISODate): Reliability {
  if (ev.dateKind === "trend") {
    if (!ev.lastVerified || !ev.source.url) return "te_verifieren";
    if (ev.expiresAt && ev.expiresAt < today) return "verlopen";
    return "betrouwbaar";
  }
  if (ev.dateKind === "verified") {
    if (ev.rule.kind === "explicit") {
      const o = ev.rule.occurrences.find((x) => x.start === occ.start);
      return o?.verifiedAt ? "betrouwbaar" : "te_verifieren";
    }
    return ev.lastVerified ? "betrouwbaar" : "te_verifieren";
  }
  if (ev.dateKind === "computed") return "berekend";
  return "betrouwbaar";
}

export const occurrenceKey = (eventId: string, start: ISODate) => `${eventId}:${start}`;

/** Alle voorkomens die overlappen met [from, to]. Gesorteerd, zonder dubbelingen. */
export function occurrencesBetween(
  events: SeasonalEvent[],
  from: ISODate,
  to: ISODate,
  today: ISODate,
): EventOccurrence[] {
  const y0 = Number(from.slice(0, 4)) - 1;
  const y1 = Number(to.slice(0, 4));
  const seen = new Set<string>();
  const out: EventOccurrence[] = [];
  for (const ev of events) {
    for (let y = y0; y <= y1; y++) {
      for (const o of occurrencesInYear(ev, y)) {
        if (!overlaps(o.start, o.end, from, to)) continue;
        const key = occurrenceKey(ev.id, o.start);
        if (seen.has(key)) continue;
        seen.add(key);
        const reliability = reliabilityOf(ev, o, today);
        if (reliability === "verlopen") continue;
        out.push({ ...o, key, reliability });
      }
    }
  }
  return out.sort((a, b) => (a.start === b.start ? a.eventId.localeCompare(b.eventId) : a.start < b.start ? -1 : 1));
}

export function parseOccurrenceKey(key: string): { eventId: string; start: ISODate } {
  const i = key.lastIndexOf(":");
  return { eventId: key.slice(0, i), start: key.slice(i + 1) };
}

export const RELIABILITY_LABELS: Record<Reliability, string> = {
  betrouwbaar: "Vaste datum",
  berekend: "Berekend",
  te_verifieren: "Te verifiëren",
  verlopen: "Verlopen",
};
