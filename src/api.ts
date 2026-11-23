// Frontend-client voor de ContentFlow-server. Bevat geen sleutels: alle AI-aanroepen lopen via /api.
import type { ContentFormat, PillarId } from "./domain/types";

export type AIMode = "fast" | "smart" | "council";
export type ProviderId = "anthropic" | "openai";

export interface AIStatus {
  providers: { id: ProviderId; label: string; model: string; configured: boolean; problem: string | null }[];
  budget: { monthlyBudgetUSD: number; spentUSD: number; councilRunsUsed: number; councilMonthlyLimit: number };
  modes: { mode: AIMode; maxCalls: number; worstCaseUSD: number | null }[];
}

export interface Proposal {
  title: string; hook: string; format: ContentFormat; pillar: PillarId; concept: string; script: string; caption: string;
  shotlist: string[];
  recipe: { servings: number; ingredients: { item: string; amount: number; unit: string }[]; steps: string[] } | null;
  estimatedProductionMinutes: number; assumptions: string[]; missingData: string[]; factChecksNeeded: string[];
}

export interface Review {
  scores: Record<string, number>; estimatedProductionMinutes: number; performanceDataUsed: boolean;
  strengths: string[]; possibleErrors: string[]; risks: string[]; missingData: string[]; improvements: string[];
  verdict: "sterk" | "bruikbaar" | "zwak";
}

export interface JobStep {
  name: string; kind: "proposal" | "review" | "synthesis"; provider: ProviderId; model: string; reviewOf?: ProviderId;
  output?: unknown; costUSD: number; inputTokens: number; outputTokens: number; error?: string;
}

export interface AIJob {
  id: string; createdAt: string; mode: AIMode; status: "klaar" | "mislukt"; steps: JobStep[];
  differences: { topic: string; detail: string }[]; final: Proposal | null;
  changeLog: { change: string; reason: string }[]; openQuestions: string[]; modelsUsed: string[];
  fallbackUsed: string | null; verification: "niet_geverifieerd"; totalCostUSD: number; error?: string; cached?: boolean;
  brief: { task: string };
}

export interface Brief {
  task: string;
  creator: { name: string; brandVoice: string; audience: string; pillars: string[] };
  event?: { name: string; date: string } | null;
  idea?: { title: string; hook?: string; description?: string; format?: ContentFormat; pillar?: PillarId } | null;
  performanceData?: string | null;
  constraints?: string[];
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !(body && typeof body === "object" && "steps" in body)) {
    throw new Error((body as { error?: string }).error ?? `Serverfout (${res.status})`);
  }
  return body as T;
}

export interface HookResult {
  hooks: { hook: string; angle: string }[];
  caption: string;
  hashtags: string[];
  notes: string[];
  model: string;
  costUSD: number;
  cached?: boolean;
}

export const api = {
  hooks: (request: { creator: Brief["creator"]; item: { title: string; hook?: string; description?: string; format: ContentFormat; pillar: PillarId } }) =>
    fetch("/api/ai/hooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request }),
    }).then((r) => json<HookResult>(r)),
  status: () => fetch("/api/ai/status").then((r) => json<AIStatus>(r)),
  jobs: () => fetch("/api/ai/jobs").then((r) => json<{ id: string; createdAt: string; mode: AIMode; status: string; title: string; totalCostUSD: number }[]>(r)),
  job: (id: string) => fetch(`/api/ai/jobs/${id}`).then((r) => json<AIJob>(r)),
  generate: (mode: AIMode, brief: Brief, primary: ProviderId) =>
    fetch("/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, brief, primary }),
    }).then((r) => json<AIJob>(r)),
};
