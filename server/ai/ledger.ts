// Token- en kostenregistratie, maandbudget en opslag van AI-jobs (voor het AI Review-scherm).
// Opslag: JSON-bestanden in ./data (MVP, single-tenant). In productie vervangen door de
// tabellen ai_generation_jobs / ai_usage_ledger uit supabase/migrations.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Pricing, ProviderId, Usage } from "./providers/types";

export interface LedgerEntry {
  at: string;
  jobId: string;
  step: string;
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
}

export interface Store<T> {
  load(): T;
  save(v: T): void;
}

export function fileStore<T>(path: string, empty: T): Store<T> {
  return {
    load() {
      if (!existsSync(path)) return structuredClone(empty);
      try {
        return JSON.parse(readFileSync(path, "utf8")) as T;
      } catch {
        return structuredClone(empty);
      }
    },
    save(v) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(v, null, 2));
    },
  };
}

export function memoryStore<T>(initial: T): Store<T> {
  let v = structuredClone(initial);
  return { load: () => v, save: (n) => { v = n; } };
}

export function costOf(usage: Usage, pricing: Pricing): number {
  return (usage.inputTokens * pricing.inputPerMTok + usage.outputTokens * pricing.outputPerMTok) / 1_000_000;
}

export class Ledger {
  constructor(private store: Store<LedgerEntry[]>) {}

  record(e: LedgerEntry) {
    const all = this.store.load();
    all.push(e);
    this.store.save(all);
  }

  monthEntries(now = new Date()): LedgerEntry[] {
    const prefix = now.toISOString().slice(0, 7);
    return this.store.load().filter((e) => e.at.startsWith(prefix));
  }

  monthSpendUSD(now = new Date()): number {
    return this.monthEntries(now).reduce((s, e) => s + e.costUSD, 0);
  }

  councilRunsThisMonth(now = new Date()): number {
    const jobs = new Set(this.monthEntries(now).filter((e) => e.step.startsWith("council")).map((e) => e.jobId));
    return jobs.size;
  }

  summary(now = new Date()) {
    const entries = this.monthEntries(now);
    const byProvider: Record<string, { inputTokens: number; outputTokens: number; costUSD: number; calls: number }> = {};
    for (const e of entries) {
      const b = (byProvider[`${e.provider}:${e.model}`] ??= { inputTokens: 0, outputTokens: 0, costUSD: 0, calls: 0 });
      b.inputTokens += e.inputTokens;
      b.outputTokens += e.outputTokens;
      b.costUSD += e.costUSD;
      b.calls += 1;
    }
    return { month: now.toISOString().slice(0, 7), spendUSD: this.monthSpendUSD(now), byProvider };
  }
}

/** Eenvoudige rate limiter (vast venster per minuut, per sleutel). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private perMinute: number) {}
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= this.perMinute) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

/** Kleine TTL-cache voor identieke briefings (scheelt dubbele kosten bij dubbelklikken/herladen). */
export class TTLCache<V> {
  private m = new Map<string, { v: V; exp: number }>();
  constructor(private ttlMs: number, private max = 200) {}
  get(k: string): V | undefined {
    const hit = this.m.get(k);
    if (!hit) return undefined;
    if (hit.exp < Date.now()) { this.m.delete(k); return undefined; }
    return hit.v;
  }
  set(k: string, v: V) {
    if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value!);
    this.m.set(k, { v, exp: Date.now() + this.ttlMs });
  }
}
