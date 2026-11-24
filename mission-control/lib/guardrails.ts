// Vangrails die in code zitten, niet in een prompt. Pure functies, getest in tests/guardrails.test.ts.
import type { Channel, InboxItem, Settings } from "./types";
import { amsDayAt, amsParts } from "./time";

export const SEND_WINDOW = { startHour: 8, startMinute: 0, endHour: 17, endMinute: 30 };
export const RECONTACT_DAYS = 14;

/** Kanalen waarbij een tweede benadering binnen 14 dagen verboden is (één-op-één contact). */
const PERSONAL_TYPES = new Set(["dm", "connect", "email", "call", "letter", "pitch"]);

export function isWorkday(d: Date): boolean {
  const wd = amsParts(d).weekday;
  return wd >= 1 && wd <= 5;
}

export function isInSendWindow(d: Date): boolean {
  if (!isWorkday(d)) return false;
  const { hour, minute } = amsParts(d);
  const m = hour * 60 + minute;
  const start = SEND_WINDOW.startHour * 60 + SEND_WINDOW.startMinute;
  const end = SEND_WINDOW.endHour * 60 + SEND_WINDOW.endMinute;
  return m >= start && m < end;
}

/** Eerstvolgend moment binnen het verzendvenster (d zelf als die er al in valt). */
export function nextSendWindowStart(d: Date): Date {
  if (isInSendWindow(d)) return d;
  const { hour, minute } = amsParts(d);
  const beforeStartToday = hour * 60 + minute < SEND_WINDOW.startHour * 60 + SEND_WINDOW.startMinute;
  for (let add = beforeStartToday ? 0 : 1; add < 8; add++) {
    const candidate = amsDayAt(d, add, SEND_WINDOW.startHour, SEND_WINDOW.startMinute);
    if (isWorkday(candidate)) return candidate;
  }
  throw new Error("Geen verzendvenster gevonden");
}

export type BudgetState = "ok" | "warn" | "stop";

export function budgetState(spentEur: number, budgetEur: number): BudgetState {
  if (budgetEur <= 0) return "stop";
  const ratio = spentEur / budgetEur;
  if (ratio >= 1) return "stop";
  if (ratio >= 0.8) return "warn";
  return "ok";
}

export function normalizeKey(v: string): string {
  return v.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
}

/** Afmeldlijst: matcht op exacte sleutel, of op domein (een afgemeld domein blokkeert iedereen op dat domein). */
export function isSuppressed(recipientKey: string | null, suppressed: string[]): boolean {
  if (!recipientKey) return false;
  const key = normalizeKey(recipientKey);
  const domain = key.includes("@") ? key.split("@")[1] : null;
  return suppressed.some((s) => {
    const n = normalizeKey(s);
    return n === key || (domain !== null && n === domain);
  });
}

export interface DispatchContext {
  now: Date;
  settings: Settings;
  sentTodayByChannel: Partial<Record<Channel, number>>;
  suppressed: string[];
  /** Laatste verzending naar dezelfde recipient_key (ander item), of null. */
  lastContactAt: Date | null;
  /** Is de ontvanger al klant? (Leads komen in sprint 3; tot dan altijd false.) */
  isCustomer: boolean;
}

export type DispatchDecision =
  | { action: "send" }
  | { action: "defer"; until: Date; reason: string }
  | { action: "block"; reason: string };

/**
 * Beslist of een goedgekeurd item nú de deur uit mag.
 * Volgorde: harde blokkades eerst, dan uitstel (venster / gepland moment / daglimiet).
 */
export function decideDispatch(item: InboxItem, ctx: DispatchContext): DispatchDecision {
  if (item.status !== "approved" && item.status !== "scheduled") {
    return { action: "block", reason: `Status is ${item.status}, niet goedgekeurd` };
  }
  if (ctx.settings.paused) {
    return { action: "defer", until: new Date(ctx.now.getTime() + 15 * 60_000), reason: "Alles staat op pauze" };
  }
  if (item.channel === "email" && item.type === "email" && item.payload.tags?.includes("koud") && !ctx.settings.cold_email_enabled) {
    return { action: "block", reason: "Koude e-mail staat uit" };
  }
  if (isSuppressed(item.recipient_key, ctx.suppressed)) {
    return { action: "block", reason: "Ontvanger staat op de afmeldlijst" };
  }
  if (ctx.isCustomer && PERSONAL_TYPES.has(item.type)) {
    return { action: "block", reason: "Ontvanger is al klant" };
  }
  if (PERSONAL_TYPES.has(item.type) && ctx.lastContactAt) {
    const days = (ctx.now.getTime() - ctx.lastContactAt.getTime()) / 86_400_000;
    if (days < RECONTACT_DAYS) {
      return { action: "block", reason: `Al benaderd ${Math.floor(days)} dag(en) geleden (minimaal ${RECONTACT_DAYS})` };
    }
  }
  if (item.send_after && new Date(item.send_after) > ctx.now) {
    return { action: "defer", until: new Date(item.send_after), reason: "Ongedaan-maken-venster loopt nog" };
  }
  if (item.scheduled_at && new Date(item.scheduled_at) > ctx.now) {
    return { action: "defer", until: nextSendWindowStart(new Date(item.scheduled_at)), reason: "Gepland moment" };
  }
  if (!isInSendWindow(ctx.now)) {
    return { action: "defer", until: nextSendWindowStart(ctx.now), reason: "Buiten verzendvenster (werkdagen 08:00–17:30)" };
  }
  const limit = ctx.settings.daily_limits[item.channel];
  const sent = ctx.sentTodayByChannel[item.channel] ?? 0;
  if (limit !== undefined && sent >= limit) {
    const tomorrow = nextSendWindowStart(amsDayAt(ctx.now, 1, 0, 0));
    return { action: "defer", until: tomorrow, reason: `Daglimiet ${item.channel} bereikt (${limit})` };
  }
  return { action: "send" };
}

/** Bulk-bevestiging: tel per kanaal, zodat de bevestiging aantallen kan tonen. */
export function countByChannel(items: Pick<InboxItem, "channel">[]): Partial<Record<Channel, number>> {
  const out: Partial<Record<Channel, number>> = {};
  for (const i of items) out[i.channel] = (out[i.channel] ?? 0) + 1;
  return out;
}
