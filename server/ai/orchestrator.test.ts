// Test-doubles voor providers: alleen in tests. De app zelf gebruikt nooit gesimuleerde antwoorden.
import { describe, expect, it } from "vitest";
import { Ledger, memoryStore, type LedgerEntry } from "./ledger";
import { type AIJob, BudgetError, Orchestrator } from "./orchestrator";
import type { AIProvider, ProviderId } from "./providers/types";
import { ProviderError } from "./providers/types";
import type { Brief, Proposal, Review } from "./schemas";

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  title: "Speculaas-tiramisu", hook: "h", format: "reel", pillar: "recepten", concept: "c", script: "s",
  caption: "cap", shotlist: ["a"], recipe: null, estimatedProductionMinutes: 60,
  assumptions: [], missingData: [], factChecksNeeded: ["voedingswaarde"], ...over,
});
const review = (over: Partial<Review> = {}): Review => ({
  scores: { originaliteit: 4, doelgroeprelevantie: 4, merkstem: 4, uitvoerbaarheid: 4, creatieveKwaliteit: 4, commercieleGeschiktheid: 3 },
  estimatedProductionMinutes: 60, performanceDataUsed: false, strengths: [], possibleErrors: [], risks: [],
  missingData: [], improvements: [], verdict: "sterk", ...over,
});

function fake(id: ProviderId, opts: { fail?: boolean; reviewVerdict?: Review["verdict"]; format?: Proposal["format"] } = {}) {
  const calls: string[] = [];
  const p: AIProvider = {
    id, label: id, model: `${id}-model`, configured: true, pricing: { inputPerMTok: 1, outputPerMTok: 10 },
    async generateJSON({ schemaName }) {
      calls.push(schemaName);
      if (opts.fail) throw new ProviderError("down", id, true);
      const data =
        schemaName === "proposal" ? proposal({ format: opts.format ?? "reel" })
        : schemaName === "review" ? review({ verdict: opts.reviewVerdict ?? "sterk", possibleErrors: opts.reviewVerdict === "zwak" ? ["hoeveelheid klopt niet"] : [] })
        : { proposal: proposal({ title: "Synthese" }), changeLog: [{ change: "x", reason: "y" }], resolvedDisagreements: [], openQuestions: [] };
      return { data: data as never, usage: { inputTokens: 1000, outputTokens: 500 }, model: `${id}-model`, provider: id };
    },
  };
  return { p, calls };
}

const brief: Brief = {
  task: "Bedenk een origineel low-cal kerstrecept", creator: { name: "FitMetThies", brandVoice: "eerlijk", audience: "moeders", pillars: ["recepten"] },
};
const mk = (a: AIProvider, b: AIProvider, cfg: Partial<{ monthlyBudgetUSD: number; councilMonthlyLimit: number }> = {}) =>
  new Orchestrator({ anthropic: a, openai: b }, new Ledger(memoryStore<LedgerEntry[]>([])), memoryStore<AIJob[]>([]),
    { monthlyBudgetUSD: 100, councilMonthlyLimit: 5, maxTokens: 2000, ...cfg });

describe("Orchestrator", () => {
  it("Snel: precies één aanroep en kosten geregistreerd", async () => {
    const a = fake("anthropic"), b = fake("openai");
    const job = await mk(a.p, b.p).run("fast", brief);
    expect(a.calls).toEqual(["proposal"]);
    expect(b.calls).toEqual([]);
    expect(job.totalCostUSD).toBeCloseTo(0.006, 6);
    expect(job.verification).toBe("niet_geverifieerd");
  });

  it("Slim: verbetert alleen als de review dat nodig vindt", async () => {
    const good = fake("anthropic");
    await mk(good.p, fake("openai").p).run("smart", brief);
    expect(good.calls).toEqual(["proposal", "review"]);
    const weak = fake("anthropic", { reviewVerdict: "zwak" });
    const job = await mk(weak.p, fake("openai").p).run("smart", brief);
    expect(weak.calls).toEqual(["proposal", "review", "synthesis"]);
    expect(job.changeLog.length).toBe(1);
  });

  it("Council: beide modellen, kruisreview, verschillen, max. 7 aanroepen", async () => {
    const a = fake("anthropic"), b = fake("openai", { format: "carrousel", reviewVerdict: "zwak" });
    const job = await mk(a.p, b.p).run("council", brief);
    expect(a.calls.length + b.calls.length).toBeLessThanOrEqual(7);
    expect(job.differences.some((d) => d.topic === "Format")).toBe(true);
    expect(job.final?.title).toBe("Synthese");
    expect(job.modelsUsed.length).toBe(2);
  });

  it("Council weigert zonder tweede provider", async () => {
    const b = fake("openai"); b.p.configured = false; b.p.configProblem = "OPENAI_API_KEY ontbreekt";
    await expect(mk(fake("anthropic").p, b.p).run("council", brief)).rejects.toBeInstanceOf(BudgetError);
  });

  it("Provider-fallback bij uitval in Snel", async () => {
    const job = await mk(fake("anthropic", { fail: true }).p, fake("openai").p).run("fast", brief);
    expect(job.status).toBe("klaar");
    expect(job.fallbackUsed).toContain("overgeschakeld");
  });

  it("Budgetbewaking blokkeert vóór er kosten zijn", async () => {
    const a = fake("anthropic");
    await expect(mk(a.p, fake("openai").p, { monthlyBudgetUSD: 0.01 }).run("council", brief)).rejects.toThrow(/budget/i);
    expect(a.calls).toEqual([]);
  });

  it("Cache: identieke briefing kost niets extra", async () => {
    const a = fake("anthropic");
    const o = mk(a.p, fake("openai").p);
    await o.run("fast", brief);
    const again = await o.run("fast", brief);
    expect(again.cached).toBe(true);
    expect(a.calls.length).toBe(1);
  });
});
