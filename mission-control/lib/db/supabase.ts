import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repo } from "./repo";
import { DEFAULT_SETTINGS, EMPTY_BRAIN, type AgentRun, type Brain, type Channel, type Settings } from "../types";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/**
 * Supabase-implementatie. Krijgt óf een client met jouw sessie (RLS: alleen de eigenaar),
 * óf de service-role-client (cron, agents, dispatcher).
 */
export function createSupabaseRepo(db: SupabaseClient): Repo {
  return {
    mode: "supabase",

    async getBrain() {
      const row = check(await db.from("brain").select("*").eq("id", 1).maybeSingle());
      return row ? ({ ...EMPTY_BRAIN, ...(row as Brain) }) : { ...EMPTY_BRAIN };
    },
    async saveBrain(b) {
      check(await db.from("brain").upsert({ id: 1, ...b, updated_at: new Date().toISOString() }));
    },
    async appendLearning(l) {
      // Atomair aan de databasekant, zodat gelijktijdige afwijzingen elkaar niet overschrijven.
      check(await db.rpc("append_learning", { learning: l }));
    },

    async getSettings() {
      const row = check(await db.from("settings").select("*").eq("id", 1).maybeSingle());
      return { ...DEFAULT_SETTINGS, ...((row as unknown as Partial<Settings> | null) ?? {}) };
    },
    async saveSettings(patch) {
      const row = check(await db.from("settings").upsert({ id: 1, ...patch }).select("*").single());
      return { ...DEFAULT_SETTINGS, ...(row as unknown as Partial<Settings>) };
    },

    async listInbox({ statuses, limit }) {
      let q = db.from("inbox_items").select("*").in("status", statuses).order("priority", { ascending: false }).order("created_at");
      if (limit) q = q.limit(limit);
      return check(await q);
    },
    async getInboxItem(id) {
      return check(await db.from("inbox_items").select("*").eq("id", id).maybeSingle());
    },
    async createInboxItems(items) {
      if (items.length === 0) return [];
      return check(await db.from("inbox_items").insert(items).select("*"));
    },
    async updateInboxItem(id, patch) {
      const { id: _drop, created_at: _c, ...rest } = patch;
      return check(await db.from("inbox_items").update(rest).eq("id", id).select("*").single());
    },

    async addDispatchLog(e) {
      check(await db.from("dispatch_log").insert(e));
    },
    async listDispatchLog(limit) {
      return check(await db.from("dispatch_log").select("*").order("at", { ascending: false }).limit(limit));
    },
    async sentCountSince(since) {
      const rows = check(
        await db.from("dispatch_log").select("channel").in("outcome", ["sent", "manual"]).gte("at", since.toISOString()),
      ) as { channel: Channel }[];
      const out: Partial<Record<Channel, number>> = {};
      for (const r of rows) out[r.channel] = (out[r.channel] ?? 0) + 1;
      return out;
    },
    async lastContact(key, excludeItemId) {
      const row = check(
        await db
          .from("dispatch_log")
          .select("at")
          .eq("recipient_key", key)
          .neq("inbox_item_id", excludeItemId)
          .in("outcome", ["sent", "manual"])
          .order("at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as { at: string } | null;
      return row ? new Date(row.at) : null;
    },

    async listIdeas(statuses, limit) {
      let q = db.from("content_ideas").select("*").in("status", statuses).order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      return check(await q);
    },
    async createIdeas(ideas) {
      if (ideas.length === 0) return [];
      return check(await db.from("content_ideas").insert(ideas).select("*"));
    },
    async updateIdea(id, patch) {
      return check(await db.from("content_ideas").update(patch).eq("id", id).select("*").single());
    },

    async listCalendar(from, to) {
      return check(
        await db.from("calendar").select("*").gte("slot_at", from.toISOString()).lt("slot_at", to.toISOString()).order("slot_at"),
      );
    },
    async getCalendarEntry(id) {
      return check(await db.from("calendar").select("*").eq("id", id).maybeSingle());
    },
    async createCalendarEntry(e) {
      return check(await db.from("calendar").insert(e).select("*").single());
    },
    async updateCalendarEntry(id, patch) {
      return check(await db.from("calendar").update(patch).eq("id", id).select("*").single());
    },

    async listKeywords() {
      return check(await db.from("keywords").select("*").order("checked_at", { ascending: false }).limit(200));
    },
    async addKeyword(keyword) {
      check(await db.from("keywords").insert({ keyword }));
    },

    async listSuppression() {
      return check(await db.from("suppression").select("*").order("created_at", { ascending: false }));
    },
    async addSuppression(value, reason) {
      check(await db.from("suppression").upsert({ value, reason }, { onConflict: "value" }));
    },

    async startRun(agent, trigger) {
      return check(await db.from("agent_runs").insert({ agent, trigger, status: "running" }).select("*").single()) as AgentRun;
    },
    async finishRun(id, patch) {
      check(await db.from("agent_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", id));
    },
    async listRuns(limit) {
      return check(await db.from("agent_runs").select("*").order("started_at", { ascending: false }).limit(limit));
    },
    async costSince(since) {
      const rows = check(await db.from("agent_runs").select("cost_eur").gte("started_at", since.toISOString())) as {
        cost_eur: number;
      }[];
      return rows.reduce((s, r) => s + Number(r.cost_eur), 0);
    },
  };
}
