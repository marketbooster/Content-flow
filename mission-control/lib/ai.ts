import "server-only";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { Brain } from "./types";

// Prijzen per 1M tokens in USD (anthropic.com/pricing). Kosten worden in euro gelogd.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};
const USD_TO_EUR = Number(process.env.USD_TO_EUR ?? 0.92);

export const MODEL_WRITE = process.env.CLAUDE_MODEL_WRITE || "claude-opus-5-5";
export const MODEL_SCAN = process.env.CLAUDE_MODEL_SCAN || "claude-haiku-5-5";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costEur: number;
}

export class AIError extends Error {}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIError("ANTHROPIC_API_KEY ontbreekt");
  client ??= new Anthropic({ maxRetries: 2, timeout: 240_000 });
  return client;
}

export function loadPrompt(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), "prompts", `${name}.md`), "utf8");
}

/** Het merkbrein als vaste systeemcontext, gedeeld door alle agents (spelregel 3). */
export function brainContext(brain: Brain): string {
  const learnings = brain.learnings
    .slice(-40)
    .map((l) => `- [${l.kind}] ${l.note}${l.excerpt ? ` — "${l.excerpt.slice(0, 120)}"` : ""}`)
    .join("\n");
  return [
    "# Merkbrein Marketbooster",
    `## Toon\n${brain.tone || "(nog niet ingevuld)"}`,
    `## Ideale klant (ICP)\n${brain.icp || "(nog niet ingevuld)"}`,
    `## Contentpijlers\n${brain.pillars.map((p) => `- ${p}`).join("\n")}`,
    `## Aanbod en prijzen\n${brain.prices || "(nog niet ingevuld)"}`,
    `## Verboden woorden (gebruik deze nooit)\n${brain.forbidden_words.join(", ") || "(geen)"}`,
    `## Wat werkte\n${brain.what_worked || "(nog geen data)"}`,
    `## Learnings uit afwijzingen en bijsturing (recent)\n${learnings || "(nog geen)"}`,
    "## Vaste positionering\nAI geeft MKB tijd terug. AI vervangt geen personeel.",
  ].join("\n\n");
}

/**
 * Eén gestructureerde Claude-aanroep. Merkbrein en agent-instructie staan in de system prompt
 * (gecachet), de variabele taak in het user-bericht.
 */
export async function callStructured<S extends z.ZodType>(opts: {
  agentPrompt: string;
  brain: Brain;
  task: string;
  schema: S;
  model?: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<{ data: z.infer<S>; usage: Usage }> {
  const model = opts.model ?? MODEL_WRITE;
  const anthropic = getClient();
  try {
    const stream = anthropic.beta.messages.stream({
      model,
      max_tokens: opts.maxTokens ?? 32000,
      system: [
        { type: "text", text: opts.agentPrompt },
        { type: "text", text: brainContext(opts.brain), cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: opts.task }],
      output_config: { effort: opts.effort ?? "medium", format: zodOutputFormat(opts.schema) },
      // Bij een onterechte weigering door een veiligheidsclassifier schakelt de API zelf over.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AIError("Claude weigerde dit verzoek.");
    if (msg.stop_reason === "max_tokens") throw new AIError("Antwoord afgekapt (max_tokens).");
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const data = opts.schema.parse(JSON.parse(text));
    const inputTokens =
      msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0);
    const outputTokens = msg.usage.output_tokens;
    return { data, usage: { inputTokens, outputTokens, costEur: cost(msg.model ?? model, msg.usage) } };
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new AIError("Claude API-sleutel ongeldig of zonder toegang.");
    }
    if (err instanceof Anthropic.RateLimitError) throw new AIError("Claude rate limit bereikt; probeer het later.");
    if (err instanceof Anthropic.BadRequestError) throw new AIError(`Claude weigerde het verzoek: ${err.message}`);
    if (err instanceof Anthropic.APIError) throw new AIError(`Claude API-fout (${err.status ?? "netwerk"}).`);
    throw err;
  }
}

function cost(
  model: string,
  u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null },
): number {
  const p = PRICING[model] ?? PRICING["claude-opus-5-5"];
  const usd =
    (u.input_tokens * p.input +
      (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 +
      (u.cache_read_input_tokens ?? 0) * p.input * 0.1 +
      u.output_tokens * p.output) /
    1_000_000;
  return Math.round(usd * USD_TO_EUR * 10_000) / 10_000;
}

export const addUsage = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  costEur: Math.round((a.costEur + b.costEur) * 10_000) / 10_000,
});
export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, costEur: 0 };
