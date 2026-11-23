// ContentFlow API-server. Alle AI-aanroepen gebeuren hier; API-sleutels komen nooit in de frontend.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { createHash, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { fileStore, Ledger, type LedgerEntry, RateLimiter } from "./ai/ledger";
import { type AIJob, BudgetError, Orchestrator } from "./ai/orchestrator";
import { createAnthropicProvider } from "./ai/providers/anthropic";
import { createOpenAIProvider } from "./ai/providers/openai";
import { ProviderError } from "./ai/providers/types";
import { BriefingRequestSchema, BriefSchema, HookRequestSchema } from "./ai/schemas";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* geen .env: prima, dan draait de app zonder AI */
}

const env = process.env;
const timeoutMs = Number(env.AI_TIMEOUT_MS) || 120_000;

/** Vergelijkt wachtwoorden in constante tijd (geen timing-lek). */
function samePassword(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function createApp(orchestrator: Orchestrator, limiter: RateLimiter, password?: string) {
  const app = new Hono();

  // Health check blijft open (voor de hostingdienst); al het andere achter het wachtwoord.
  app.get("/api/health", (c) => c.json({ ok: true }));
  if (password) {
    app.use("*", basicAuth({ verifyUser: (_user, pass) => samePassword(pass, password), realm: "ContentFlow" }));
  }
  app.get("/api/ai/status", (c) => c.json(orchestrator.status()));
  app.get("/api/ai/jobs", (c) => c.json(orchestrator.listJobs()));
  app.get("/api/ai/jobs/:id", (c) => {
    const job = orchestrator.getJob(c.req.param("id"));
    return job ? c.json(job) : c.json({ error: "Niet gevonden" }, 404);
  });

  const GenerateBody = z.object({
    mode: z.enum(["fast", "smart", "council"]),
    primary: z.enum(["anthropic", "openai"]).default("anthropic"),
    brief: BriefSchema,
  });

  app.post("/api/ai/generate", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!limiter.allow(ip)) return c.json({ error: "Te veel verzoeken; probeer het over een minuut opnieuw." }, 429);
    const parsed = GenerateBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Ongeldige briefing", details: parsed.error.issues }, 400);
    try {
      const job: AIJob = await orchestrator.run(parsed.data.mode, parsed.data.brief, parsed.data.primary, c.req.raw.signal);
      return c.json(job, job.status === "klaar" ? 200 : 502);
    } catch (err) {
      if (err instanceof BudgetError) return c.json({ error: err.message }, 402);
      console.error(err);
      return c.json({ error: "Onverwachte serverfout" }, 500);
    }
  });

  const HooksBody = z.object({ primary: z.enum(["anthropic", "openai"]).default("anthropic"), request: HookRequestSchema });
  app.post("/api/ai/hooks", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!limiter.allow(ip)) return c.json({ error: "Te veel verzoeken; probeer het over een minuut opnieuw." }, 429);
    const parsed = HooksBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Ongeldig verzoek", details: parsed.error.issues }, 400);
    try {
      return c.json(await orchestrator.hooks(parsed.data.request, parsed.data.primary, c.req.raw.signal));
    } catch (err) {
      if (err instanceof BudgetError) return c.json({ error: err.message }, 402);
      if (err instanceof ProviderError) return c.json({ error: err.message }, 502);
      console.error(err);
      return c.json({ error: "Onverwachte serverfout" }, 500);
    }
  });

  const BriefingBody = z.object({ primary: z.enum(["anthropic", "openai"]).default("anthropic"), request: BriefingRequestSchema });
  app.post("/api/ai/briefing", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!limiter.allow(ip)) return c.json({ error: "Te veel verzoeken; probeer het over een minuut opnieuw." }, 429);
    const parsed = BriefingBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Ongeldig verzoek" }, 400);
    try {
      return c.json(await orchestrator.briefing(parsed.data.request, parsed.data.primary, c.req.raw.signal));
    } catch (err) {
      if (err instanceof BudgetError) return c.json({ error: err.message }, 402);
      if (err instanceof ProviderError) return c.json({ error: err.message }, 502);
      console.error(err);
      return c.json({ error: "Onverwachte serverfout" }, 500);
    }
  });

  return app;
}

const isMain = process.argv[1]?.endsWith("server/index.ts");
if (isMain) {
  const production = env.NODE_ENV === "production";
  const password = env.APP_PASSWORD?.trim();
  // Online zonder wachtwoord zou iedereen met de link jouw API-tegoed kunnen gebruiken.
  if (production && (!password || password.length < 12)) {
    console.error("APP_PASSWORD ontbreekt of is korter dan 12 tekens. De server start niet zonder bescherming.");
    process.exit(1);
  }
  // DATA_DIR: map op een blijvend volume, zodat kostenregistratie een herstart overleeft.
  const dataDir = env.DATA_DIR || "data";
  const orchestrator = new Orchestrator(
    {
      anthropic: createAnthropicProvider(env, timeoutMs),
      openai: createOpenAIProvider(env, timeoutMs),
    },
    new Ledger(fileStore<LedgerEntry[]>(join(dataDir, "ai-ledger.json"), [])),
    fileStore<AIJob[]>(join(dataDir, "ai-jobs.json"), []),
    {
      monthlyBudgetUSD: Number(env.AI_MONTHLY_BUDGET_USD) || 25,
      councilMonthlyLimit: Number(env.AI_COUNCIL_MONTHLY_LIMIT) || 40,
      maxTokens: 16000,
    },
  );
  const app = createApp(orchestrator, new RateLimiter(Number(env.AI_REQUESTS_PER_MINUTE) || 10), password);
  if (production) {
    app.use("/*", serveStatic({ root: "./dist" }));
    app.get("*", serveStatic({ path: "./dist/index.html" }));
  }
  const port = Number(env.PORT) || 8787;
  serve({ fetch: app.fetch, port });
  console.log(`ContentFlow API op http://localhost:${port}`);
}
