import { describe, expect, it } from "vitest";
import { createApp } from "./index";
import { Ledger, memoryStore, RateLimiter, type LedgerEntry } from "./ai/ledger";
import { type AIJob, Orchestrator } from "./ai/orchestrator";
import type { AIProvider, ProviderId } from "./ai/providers/types";

const off = (id: ProviderId): AIProvider => ({
  id, label: id, model: "-", pricing: null, configured: false, configProblem: "geen sleutel",
  generateJSON: async () => { throw new Error("niet gebruikt"); },
});
const orch = () => new Orchestrator({ anthropic: off("anthropic"), openai: off("openai") },
  new Ledger(memoryStore<LedgerEntry[]>([])), memoryStore<AIJob[]>([]),
  { monthlyBudgetUSD: 10, councilMonthlyLimit: 1, maxTokens: 1000 });
const basic = (pw: string) => ({ Authorization: `Basic ${Buffer.from(`ik:${pw}`).toString("base64")}` });

describe("wachtwoordbescherming", () => {
  const app = createApp(orch(), new RateLimiter(100), "geheim-wachtwoord-123");
  it("health check blijft open", async () => {
    expect((await app.request("/api/health")).status).toBe(200);
  });
  it("API zonder of met fout wachtwoord → 401", async () => {
    expect((await app.request("/api/ai/status")).status).toBe(401);
    expect((await app.request("/api/ai/status", { headers: basic("fout") })).status).toBe(401);
  });
  it("met juist wachtwoord → 200", async () => {
    expect((await app.request("/api/ai/status", { headers: basic("geheim-wachtwoord-123") })).status).toBe(200);
  });
  it("genereren zonder sleutels geeft een uitleg, geen nep-resultaat", async () => {
    const res = await app.request("/api/ai/generate", {
      method: "POST", headers: { ...basic("geheim-wachtwoord-123"), "content-type": "application/json" },
      body: JSON.stringify({ mode: "fast", brief: { task: "Bedenk een recept", creator: { name: "x", brandVoice: "", audience: "", pillars: [] } } }),
    });
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: string }).error).toMatch(/Geen AI-provider/);
  });
});
