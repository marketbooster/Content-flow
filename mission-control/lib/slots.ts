// Swipe-kalender: ritme en variatieregels. Pure functies, getest in tests/slots.test.ts.
import type { CalendarEntry, ContentFormat } from "./types";
import { amsDayAt, amsParts, startOfAmsWeek } from "./time";

export interface SlotRule {
  channel: "linkedin" | "instagram";
  /** 1 = maandag … 5 = vrijdag, 6 = zaterdag */
  weekday: number;
  hour: number;
  minute: number;
  /** Alleen dit format mag in dit slot (bijv. de wekelijkse Reel). */
  onlyFormat?: ContentFormat;
  /** Dit format mag hier niet (Reels horen in het Reel-slot). */
  notFormat?: ContentFormat;
}

/** LinkedIn 3×/week, Instagram 3×/week waarvan 1 Reel. */
export const DEFAULT_RHYTHM: SlotRule[] = [
  { channel: "linkedin", weekday: 1, hour: 8, minute: 30 },
  { channel: "linkedin", weekday: 3, hour: 8, minute: 30 },
  { channel: "linkedin", weekday: 5, hour: 8, minute: 30 },
  { channel: "instagram", weekday: 2, hour: 12, minute: 0, notFormat: "reel" },
  { channel: "instagram", weekday: 4, hour: 12, minute: 0, onlyFormat: "reel" },
  { channel: "instagram", weekday: 5, hour: 16, minute: 0, notFormat: "reel" },
];

export const MAX_SAME_PILLAR_PER_WEEK = 2;

export interface SlotCandidate {
  channel: "linkedin" | "instagram";
  format: ContentFormat;
  pillar: string;
}

function ruleDate(weekStart: Date, rule: SlotRule): Date {
  return amsDayAt(weekStart, rule.weekday - 1, rule.hour, rule.minute);
}

function fits(rule: SlotRule, c: SlotCandidate): boolean {
  if (rule.channel !== c.channel) return false;
  if (rule.onlyFormat && rule.onlyFormat !== c.format) return false;
  if (rule.notFormat && rule.notFormat === c.format) return false;
  return true;
}

function weekKey(d: Date): string {
  return startOfAmsWeek(d).toISOString();
}

/**
 * Eerstvolgend vrij slot volgens het ritme, na `now`, waarin de pijler die week
 * nog geen MAX_SAME_PILLAR_PER_WEEK keer voorkomt. Kijkt maximaal `weeksAhead` weken vooruit.
 */
export function nextFreeSlot(
  c: SlotCandidate,
  taken: Pick<CalendarEntry, "slot_at" | "pillar" | "channel">[],
  now: Date,
  rhythm: SlotRule[] = DEFAULT_RHYTHM,
  weeksAhead = 8,
): Date | null {
  const takenTimes = new Set(taken.map((t) => `${t.channel}|${new Date(t.slot_at).getTime()}`));
  const pillarPerWeek = new Map<string, number>();
  for (const t of taken) {
    if (t.pillar !== c.pillar) continue;
    const k = weekKey(new Date(t.slot_at));
    pillarPerWeek.set(k, (pillarPerWeek.get(k) ?? 0) + 1);
  }
  const rules = rhythm.filter((r) => fits(r, c)).sort((a, b) => a.weekday * 1440 + a.hour * 60 + a.minute - (b.weekday * 1440 + b.hour * 60 + b.minute));
  if (rules.length === 0) return null;

  const firstWeek = startOfAmsWeek(now);
  for (let w = 0; w < weeksAhead; w++) {
    const weekStart = amsDayAt(firstWeek, w * 7, 0, 0);
    if ((pillarPerWeek.get(weekStart.toISOString()) ?? 0) >= MAX_SAME_PILLAR_PER_WEEK) continue;
    for (const rule of rules) {
      const at = ruleDate(weekStart, rule);
      if (at <= now) continue;
      if (takenTimes.has(`${c.channel}|${at.getTime()}`)) continue;
      return at;
    }
  }
  return null;
}

/** Lege ritme-slots in een week (voor de roze vakjes in de weekweergave). */
export function emptySlotsInWeek(
  weekStart: Date,
  taken: Pick<CalendarEntry, "slot_at" | "channel">[],
  rhythm: SlotRule[] = DEFAULT_RHYTHM,
): { channel: "linkedin" | "instagram"; at: Date; onlyFormat?: ContentFormat }[] {
  const takenByDayChannel = new Set(taken.map((t) => `${t.channel}|${amsParts(new Date(t.slot_at)).day}`));
  return rhythm
    .map((r) => ({ channel: r.channel, at: ruleDate(weekStart, r), onlyFormat: r.onlyFormat }))
    .filter((s) => !takenByDayChannel.has(`${s.channel}|${amsParts(s.at).day}`));
}

export interface WeekVariation {
  pillarCounts: Record<string, number>;
  hasCase: boolean;
  hasPersonal: boolean;
  warnings: string[];
}

/** Variatieregels: max 2× dezelfde pijler, minstens één praktijkcase en één persoonlijke post per week. */
export function weekVariation(entries: Pick<CalendarEntry, "pillar" | "tags">[]): WeekVariation {
  const pillarCounts: Record<string, number> = {};
  for (const e of entries) pillarCounts[e.pillar] = (pillarCounts[e.pillar] ?? 0) + 1;
  const hasCase = entries.some((e) => e.pillar === "praktijkcases" || e.tags.includes("praktijkcase"));
  const hasPersonal = entries.some((e) => e.pillar === "achter de schermen" || e.tags.includes("persoonlijk"));
  const warnings: string[] = [];
  for (const [p, n] of Object.entries(pillarCounts)) if (n > MAX_SAME_PILLAR_PER_WEEK) warnings.push(`${p} staat ${n}× gepland`);
  if (!hasCase) warnings.push("Nog geen praktijkcase deze week");
  if (!hasPersonal) warnings.push("Nog geen persoonlijke post deze week");
  return { pillarCounts, hasCase, hasPersonal, warnings };
}

/** Behoud het tijdstip, verplaats naar een andere dag (slepen in de weekweergave). */
export function moveToDay(slotAt: Date, targetDay: Date): Date {
  const t = amsParts(slotAt);
  return amsDayAt(targetDay, 0, t.hour, t.minute);
}
