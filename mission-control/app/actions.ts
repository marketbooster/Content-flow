"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { repo, requireOwner, serviceRepo } from "@/lib/db";
import { confirmManual, dispatchItem } from "@/lib/dispatch/dispatcher";
import { produceAsset, rewriteItem, runCreatorIdeas } from "@/lib/agents/creator";
import { AgentBlocked } from "@/lib/agents/runner";
import { runRankerBrief, runRankerLinkPitch, writeBlog } from "@/lib/agents/ranker";
import { moveToDay, nextFreeSlot } from "@/lib/slots";
import { nextSendWindowStart, normalizeKey } from "@/lib/guardrails";
import { amsDayAt, startOfAmsDay } from "@/lib/time";
import type { AgentName, Settings } from "@/lib/types";

const UNDO_MS = 5_000;
const ok = <T,>(data?: T) => ({ ok: true as const, data });
const fail = (err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) });

function refresh() {
  revalidatePath("/", "layout");
}

// ── Inbox ─────────────────────────────────────────────────────────────

/** Verzend: zet op goedgekeurd met een ongedaan-maken-venster van 5 seconden. */
export async function approveItem(id: string) {
  try {
    await requireOwner();
    const r = await repo();
    await r.updateInboxItem(id, { status: "approved", send_after: new Date(Date.now() + UNDO_MS).toISOString() });
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function undoApprove(id: string) {
  try {
    await requireOwner();
    const r = await repo();
    const item = await r.getInboxItem(id);
    if (!item || item.status === "sent") throw new Error("Al verzonden; terugdraaien kan alleen in het kanaal zelf.");
    await r.updateInboxItem(id, { status: "pending", send_after: null });
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Na het ongedaan-maken-venster: dispatcher probeert te versturen (of plant in). */
export async function dispatchNow(id: string) {
  try {
    await requireOwner();
    const res = await dispatchItem(serviceRepo(), id);
    refresh();
    return ok(res);
  } catch (e) {
    return fail(e);
  }
}

export async function confirmManualSend(id: string) {
  try {
    await requireOwner();
    const res = await confirmManual(serviceRepo(), id);
    refresh();
    return ok(res);
  } catch (e) {
    return fail(e);
  }
}

export async function rejectItem(id: string, reason: string) {
  try {
    await requireOwner();
    const r = await repo();
    const item = await r.updateInboxItem(id, { status: "rejected", reject_reason: reason });
    await r.appendLearning({
      at: new Date().toISOString(),
      agent: item.agent,
      kind: "afwijzing",
      note: `${item.channel}/${item.type} afgewezen: ${reason}`,
      excerpt: item.title,
    });
    if (reason === "foute lead" && item.recipient_key) await r.addSuppression(normalizeKey(item.recipient_key), "Afgewezen als foute lead");
    if (item.calendar_id) await r.updateCalendarEntry(item.calendar_id, { status: "failed", inbox_item_id: null });
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function editItem(id: string, body: string, firstComment?: string) {
  try {
    await requireOwner();
    const r = await repo();
    const item = await r.getInboxItem(id);
    if (!item) throw new Error("Niet gevonden");
    const versions = [...(item.payload.versions ?? []), { body: item.body, at: new Date().toISOString(), instruction: "handmatig bewerkt" }];
    await r.updateInboxItem(id, { body, payload: { ...item.payload, versions, first_comment: firstComment ?? item.payload.first_comment } });
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function rewriteAction(id: string, instruction: string) {
  try {
    await requireOwner();
    const r = serviceRepo();
    const item = await r.getInboxItem(id);
    if (!item) throw new Error("Niet gevonden");
    const updated = await rewriteItem(r, item, instruction);
    refresh();
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

export async function snoozeItem(id: string, days: number) {
  try {
    await requireOwner();
    const r = await repo();
    const until = amsDayAt(new Date(), days, 7, 30);
    await r.updateInboxItem(id, { status: "snoozed", snoozed_until: until.toISOString() });
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Bulk: na bevestiging in de UI direct door de dispatcher (geen ongedaan-maken-venster). */
export async function bulkApprove(ids: string[]) {
  try {
    await requireOwner();
    const r = await repo();
    for (const id of ids) await r.updateInboxItem(id, { status: "approved", send_after: null });
    const s = serviceRepo();
    const results = [];
    for (const id of ids) results.push(await dispatchItem(s, id));
    refresh();
    return ok(results);
  } catch (e) {
    return fail(e);
  }
}

/** Blogbrief goedgekeurd: Ranker schrijft de volledige blog (gaat nog niet naar buiten). */
export async function approveBrief(id: string) {
  try {
    await requireOwner();
    const r = await repo();
    const item = await r.getInboxItem(id);
    if (!item || item.type !== "brief") throw new Error("Geen blogbrief");
    await r.updateInboxItem(id, { status: "approved" });
    after(async () => {
      const s = serviceRepo();
      try {
        await writeBlog(s, item);
        await s.updateInboxItem(id, { status: "sent", sent_at: new Date().toISOString(), result: { internal: "blog geschreven" } });
      } catch (err) {
        await s.updateInboxItem(id, { status: "pending", result: { error: err instanceof Error ? err.message : String(err) } });
      }
    });
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

// ── Swipe-kalender ────────────────────────────────────────────────────

export async function swipeIdea(id: string, direction: "right" | "left" | "up", reason?: string) {
  try {
    await requireOwner();
    const r = await repo();
    const [idea] = (await r.listIdeas(["new"])).filter((i) => i.id === id);
    if (!idea) throw new Error("Idee niet gevonden");

    if (direction === "left") {
      await r.updateIdea(id, { status: "rejected", reject_reason: reason ?? null });
      await r.appendLearning({
        at: new Date().toISOString(),
        agent: "creator",
        kind: "afwijzing",
        note: `Idee (${idea.format}, ${idea.pillar}) afgewezen: ${reason ?? "geen reden"}`,
        excerpt: idea.hook,
      });
      refresh();
      return ok({ slot: null });
    }

    const now = new Date();
    let slot: Date | null;
    if (direction === "up") {
      slot = nextSendWindowStart(new Date(now.getTime() + 30 * 60_000));
    } else {
      const taken = await r.listCalendar(startOfAmsDay(now), amsDayAt(now, 70, 0, 0));
      slot = nextFreeSlot({ channel: idea.channel, format: idea.format, pillar: idea.pillar }, taken.filter((t) => t.status !== "failed"), now);
    }
    if (!slot) throw new Error("Geen vrij slot in de komende 8 weken");

    await r.updateIdea(id, { status: direction === "up" ? "today" : "accepted" });
    const entry = await r.createCalendarEntry({
      idea_id: id,
      channel: idea.channel,
      format: idea.format,
      pillar: idea.pillar,
      hook: idea.hook,
      tags: idea.tags,
      slot_at: slot.toISOString(),
      status: "planned",
      inbox_item_id: null,
    });
    // Afmaken gebeurt na het antwoord, zodat swipen snel blijft.
    after(async () => {
      try {
        await produceAsset(serviceRepo(), entry);
      } catch (err) {
        console.error("Creator kon asset niet maken", err);
      }
    });
    refresh();
    return ok({ slot: slot.toISOString() });
  } catch (e) {
    return fail(e);
  }
}

export async function moveCalendarEntry(id: string, dayIso: string) {
  try {
    await requireOwner();
    const r = await repo();
    const entry = await r.getCalendarEntry(id);
    if (!entry) throw new Error("Niet gevonden");
    if (entry.status === "posted") throw new Error("Al geplaatst");
    const slotAt = moveToDay(new Date(entry.slot_at), new Date(dayIso));
    await r.updateCalendarEntry(id, { slot_at: slotAt.toISOString() });
    if (entry.inbox_item_id) {
      await r.updateInboxItem(entry.inbox_item_id, {
        scheduled_at: slotAt.toISOString(),
        visible_from: startOfAmsDay(slotAt).toISOString(),
      });
    }
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function retryProduce(id: string) {
  try {
    await requireOwner();
    const s = serviceRepo();
    const entry = await s.getCalendarEntry(id);
    if (!entry) throw new Error("Niet gevonden");
    await produceAsset(s, entry);
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

// ── Agents, brein, instellingen ───────────────────────────────────────

export async function runAgentNow(agent: AgentName) {
  try {
    await requireOwner();
    let run;
    if (agent === "creator") run = await runCreatorIdeas(serviceRepo(), "manual");
    else if (agent === "ranker") run = await runRankerBrief(serviceRepo(), "manual");
    else throw new Error("Deze agent wordt in een volgende sprint gebouwd.");
    refresh();
    return ok(run);
  } catch (e) {
    return fail(e instanceof AgentBlocked ? e : e);
  }
}

export async function runRankerPitchNow() {
  try {
    await requireOwner();
    const run = await runRankerLinkPitch(serviceRepo(), "manual");
    refresh();
    return ok(run);
  } catch (e) {
    return fail(e);
  }
}

export async function addKeyword(keyword: string) {
  try {
    await requireOwner();
    const k = keyword.trim().toLowerCase();
    if (!k) throw new Error("Leeg");
    await (await repo()).addKeyword(k);
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveBrain(form: FormData) {
  try {
    await requireOwner();
    const r = await repo();
    await r.saveBrain({
      tone: String(form.get("tone") ?? ""),
      icp: String(form.get("icp") ?? ""),
      pillars: lines(form.get("pillars")),
      prices: String(form.get("prices") ?? ""),
      forbidden_words: String(form.get("forbidden_words") ?? "")
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      what_worked: String(form.get("what_worked") ?? ""),
      contentbank: lines(form.get("contentbank")),
    });
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function saveSettings(patch: Partial<Settings>) {
  try {
    await requireOwner();
    const r = await repo();
    const allowed: Partial<Settings> = {};
    if (patch.paused !== undefined) allowed.paused = patch.paused;
    if (patch.monthly_budget_eur !== undefined) allowed.monthly_budget_eur = Math.max(0, Number(patch.monthly_budget_eur));
    if (patch.daily_limits) allowed.daily_limits = patch.daily_limits;
    if (patch.cron_enabled) allowed.cron_enabled = patch.cron_enabled;
    // Koude e-mail kan in sprint 1 niet aan: eerst juridische toets.
    await r.saveSettings(allowed);
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function addSuppression(value: string, reason: string) {
  try {
    await requireOwner();
    const r = await repo();
    if (!value.trim()) throw new Error("Leeg");
    await r.addSuppression(normalizeKey(value), reason || "Handmatig");
    refresh();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
