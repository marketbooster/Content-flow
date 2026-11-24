// Demo-opslag: één JSON-bestand in .data/. Alleen voor lokaal gebruik zonder Supabase.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Repo } from "./repo";
import {
  DEFAULT_SETTINGS,
  EMPTY_BRAIN,
  type AgentRun,
  type Brain,
  type CalendarEntry,
  type Channel,
  type ContentIdea,
  type DispatchLog,
  type InboxItem,
  type Settings,
  type Suppression,
} from "../types";
import { demoSeed } from "./seed";

interface State {
  brain: Brain;
  settings: Settings;
  inbox: InboxItem[];
  log: DispatchLog[];
  ideas: ContentIdea[];
  calendar: CalendarEntry[];
  suppression: Suppression[];
  runs: AgentRun[];
}

const file = () => path.join(process.cwd(), ".data", "demo.json");

function load(): State {
  try {
    return JSON.parse(fs.readFileSync(file(), "utf8")) as State;
  } catch {
    const s: State = {
      brain: { ...EMPTY_BRAIN },
      settings: { ...DEFAULT_SETTINGS },
      inbox: [],
      log: [],
      ideas: [],
      calendar: [],
      suppression: [],
      runs: [],
    };
    demoSeed(s);
    save(s);
    return s;
  }
}

function save(s: State) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(s, null, 2));
}

/** Lees-bewerk-schrijf op het bestand; houdt opeenvolgende server actions consistent. */
function tx<T>(fn: (s: State) => T): T {
  const s = load();
  const out = fn(s);
  save(s);
  return out;
}

const now = () => new Date().toISOString();

function patchIn<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`Niet gevonden: ${id}`);
  list[i] = { ...list[i], ...patch, id };
  return list[i];
}

export function createMemoryRepo(): Repo {
  return {
    mode: "demo",
    async getBrain() {
      return load().brain;
    },
    async saveBrain(b) {
      tx((s) => {
        s.brain = { ...s.brain, ...b, updated_at: now() };
      });
    },
    async appendLearning(l) {
      tx((s) => {
        s.brain.learnings = [...s.brain.learnings, l].slice(-200);
      });
    },
    async getSettings() {
      return { ...DEFAULT_SETTINGS, ...load().settings };
    },
    async saveSettings(patch) {
      return tx((s) => (s.settings = { ...DEFAULT_SETTINGS, ...s.settings, ...patch }));
    },
    async listInbox({ statuses, limit }) {
      const items = load().inbox.filter((i) => statuses.includes(i.status));
      items.sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at));
      return limit ? items.slice(0, limit) : items;
    },
    async getInboxItem(id) {
      return load().inbox.find((i) => i.id === id) ?? null;
    },
    async createInboxItems(items) {
      return tx((s) => {
        const created = items.map((i) => ({ ...i, id: i.id ?? randomUUID(), created_at: now() }) as InboxItem);
        s.inbox.push(...created);
        return created;
      });
    },
    async updateInboxItem(id, patch) {
      return tx((s) => patchIn(s.inbox, id, patch));
    },
    async addDispatchLog(e) {
      tx((s) => {
        s.log.unshift({ ...e, id: randomUUID(), at: now() });
      });
    },
    async listDispatchLog(limit) {
      return load().log.slice(0, limit);
    },
    async sentCountSince(since) {
      const out: Partial<Record<Channel, number>> = {};
      for (const l of load().log) {
        if ((l.outcome === "sent" || l.outcome === "manual") && new Date(l.at) >= since) out[l.channel] = (out[l.channel] ?? 0) + 1;
      }
      return out;
    },
    async lastContact(key, excludeItemId) {
      const hit = load().log.find(
        (l) => l.recipient_key === key && l.inbox_item_id !== excludeItemId && (l.outcome === "sent" || l.outcome === "manual"),
      );
      return hit ? new Date(hit.at) : null;
    },
    async listIdeas(statuses, limit) {
      const ideas = load().ideas.filter((i) => statuses.includes(i.status)).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return limit ? ideas.slice(0, limit) : ideas;
    },
    async createIdeas(ideas) {
      return tx((s) => {
        const created = ideas.map((i) => ({ ...i, id: randomUUID(), created_at: now() }));
        s.ideas.push(...created);
        return created;
      });
    },
    async updateIdea(id, patch) {
      return tx((s) => patchIn(s.ideas, id, patch));
    },
    async listCalendar(from, to) {
      return load()
        .calendar.filter((c) => new Date(c.slot_at) >= from && new Date(c.slot_at) < to)
        .sort((a, b) => a.slot_at.localeCompare(b.slot_at));
    },
    async getCalendarEntry(id) {
      return load().calendar.find((c) => c.id === id) ?? null;
    },
    async createCalendarEntry(e) {
      return tx((s) => {
        const c = { ...e, id: randomUUID() };
        s.calendar.push(c);
        return c;
      });
    },
    async updateCalendarEntry(id, patch) {
      return tx((s) => patchIn(s.calendar, id, patch));
    },
    async listSuppression() {
      return load().suppression;
    },
    async addSuppression(value, reason) {
      tx((s) => {
        s.suppression.push({ id: randomUUID(), value, reason, created_at: now() });
      });
    },
    async startRun(agent, trigger) {
      return tx((s) => {
        const r: AgentRun = {
          id: randomUUID(),
          agent,
          trigger,
          started_at: now(),
          finished_at: null,
          status: "running",
          input_tokens: 0,
          output_tokens: 0,
          cost_eur: 0,
          items_created: 0,
          error: null,
        };
        s.runs.unshift(r);
        return r;
      });
    },
    async finishRun(id, patch) {
      tx((s) => {
        patchIn(s.runs, id, { ...patch, finished_at: now() });
      });
    },
    async listRuns(limit) {
      return load().runs.slice(0, limit);
    },
    async costSince(since) {
      return load()
        .runs.filter((r) => new Date(r.started_at) >= since)
        .reduce((sum, r) => sum + r.cost_eur, 0);
    },
  };
}
