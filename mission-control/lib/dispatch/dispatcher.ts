import "server-only";
import type { Repo } from "../db/repo";
import type { InboxItem } from "../types";
import { decideDispatch, normalizeKey, type DispatchDecision } from "../guardrails";
import { startOfAmsDay } from "../time";
import { routeFor } from "./adapters";

/**
 * De dispatcher: de enige code die iets de deur uit laat gaan (spelregel 1).
 * Draait met de service-role-repo. Elke uitkomst komt in het logboek.
 */

export async function guardFor(repo: Repo, item: InboxItem, now = new Date()): Promise<DispatchDecision> {
  const [settings, sentToday, suppression, lastContact] = await Promise.all([
    repo.getSettings(),
    repo.sentCountSince(startOfAmsDay(now)),
    repo.listSuppression(),
    item.recipient_key ? repo.lastContact(normalizeKey(item.recipient_key), item.id) : Promise.resolve(null),
  ]);
  return decideDispatch(item, {
    now,
    settings,
    sentTodayByChannel: sentToday,
    suppressed: suppression.map((s) => s.value),
    lastContactAt: lastContact,
    isCustomer: false, // leads/klantstatus komt in sprint 3
  });
}

export type DispatchOutcome =
  | { outcome: "sent"; detail: string; externalUrl?: string }
  | { outcome: "deferred"; until: string; detail: string }
  | { outcome: "blocked" | "failed"; detail: string }
  | { outcome: "waiting_manual"; detail: string };

async function log(repo: Repo, item: InboxItem, adapter: string, outcome: "sent" | "manual" | "failed" | "blocked", detail: string, ext?: { id?: string; url?: string }) {
  await repo.addDispatchLog({
    inbox_item_id: item.id,
    channel: item.channel,
    recipient_key: item.recipient_key ? normalizeKey(item.recipient_key) : null,
    adapter,
    outcome,
    detail,
    body: item.body,
    external_id: ext?.id ?? null,
    external_url: ext?.url ?? null,
  });
}

/** Probeer één goedgekeurd item te versturen via een API-adapter. */
export async function dispatchItem(repo: Repo, id: string, now = new Date()): Promise<DispatchOutcome> {
  const item = await repo.getInboxItem(id);
  if (!item) return { outcome: "failed", detail: "Item niet gevonden" };
  if (item.status === "sent") return { outcome: "sent", detail: "Al verzonden" };

  const adapter = routeFor(item);
  if (adapter.kind === "manual") return { outcome: "waiting_manual", detail: "Wacht op jouw tik (1-tap)" };

  const decision = await guardFor(repo, item, now);
  if (decision.action === "block") {
    await repo.updateInboxItem(id, { status: "failed", result: { blocked: decision.reason } });
    await log(repo, item, adapter.id, "blocked", decision.reason);
    return { outcome: "blocked", detail: decision.reason };
  }
  if (decision.action === "defer") {
    if (item.status !== "scheduled") await repo.updateInboxItem(id, { status: "scheduled" });
    return { outcome: "deferred", until: decision.until.toISOString(), detail: decision.reason };
  }

  if (adapter.kind === "none" || !adapter.send || !adapter.configured()) {
    const detail = `${adapter.label}: nog niet gekoppeld (${adapter.missing().join(", ")})`;
    await repo.updateInboxItem(id, { status: "failed", result: { error: detail } });
    await log(repo, item, adapter.id, "failed", detail);
    return { outcome: "failed", detail };
  }

  try {
    const res = await adapter.send(item);
    await repo.updateInboxItem(id, {
      status: "sent",
      sent_at: new Date().toISOString(),
      result: { adapter: adapter.id, external_id: res.externalId ?? null, external_url: res.externalUrl ?? null },
    });
    await log(repo, item, adapter.id, "sent", res.detail, { id: res.externalId, url: res.externalUrl });
    if (item.calendar_id) await repo.updateCalendarEntry(item.calendar_id, { status: "posted" });
    return { outcome: "sent", detail: res.detail, externalUrl: res.externalUrl };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await repo.updateInboxItem(id, { status: "failed", result: { error: detail } });
    await log(repo, item, adapter.id, "failed", detail);
    return { outcome: "failed", detail };
  }
}

/** 1-tap: jij hebt geplakt en verstuurd in de andere app. Vangrails gelden nog steeds. */
export async function confirmManual(repo: Repo, id: string, now = new Date()): Promise<DispatchOutcome> {
  const item = await repo.getInboxItem(id);
  if (!item) return { outcome: "failed", detail: "Item niet gevonden" };
  const adapter = routeFor(item);
  if (adapter.kind !== "manual") return { outcome: "failed", detail: "Dit item gaat via de API" };
  // Voor 1-tap tellen alleen de harde blokkades; jij verstuurt zelf, nu.
  const decision = await guardFor(repo, { ...item, status: "approved", send_after: null, scheduled_at: null }, now);
  if (decision.action === "block") {
    await repo.updateInboxItem(id, { status: "failed", result: { blocked: decision.reason } });
    await log(repo, item, adapter.id, "blocked", decision.reason);
    return { outcome: "blocked", detail: decision.reason };
  }
  if (item.status === "pending") await repo.updateInboxItem(id, { status: "approved" });
  await repo.updateInboxItem(id, { status: "sent", sent_at: new Date().toISOString(), result: { adapter: adapter.id } });
  await log(repo, item, adapter.id, "manual", "Handmatig verstuurd (1-tap)");
  if (item.calendar_id) await repo.updateCalendarEntry(item.calendar_id, { status: "posted" });
  return { outcome: "sent", detail: "Gemarkeerd als verzonden" };
}

/** Cron: alles wat goedgekeurd is en waarvan het moment is aangebroken. */
export async function dispatchDue(repo: Repo, now = new Date()) {
  const items = await repo.listInbox({ statuses: ["approved", "scheduled"] });
  const results: { id: string; outcome: string }[] = [];
  for (const item of items) {
    if (item.send_after && new Date(item.send_after) > now) continue;
    if (routeFor(item).kind === "manual") continue;
    const r = await dispatchItem(repo, item.id, now);
    results.push({ id: item.id, outcome: r.outcome });
  }
  return results;
}
