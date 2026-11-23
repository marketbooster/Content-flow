import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AIProvider, Pricing } from "./types";
import { ProviderError } from "./types";

// Officiële eerste-partij prijzen (USD per 1M tokens). Controleer periodiek op anthropic.com/pricing.
const ANTHROPIC_PRICING: Record<string, Pricing> = {
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
};

export function createAnthropicProvider(env: NodeJS.ProcessEnv, timeoutMs: number): AIProvider {
  const model = env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const configured = Boolean(env.ANTHROPIC_API_KEY);
  const pricing = ANTHROPIC_PRICING[model] ?? null;
  const client = configured
    ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: timeoutMs, maxRetries: 2 })
    : null;

  return {
    id: "anthropic",
    label: "Claude",
    model,
    pricing,
    configured: configured && pricing !== null,
    configProblem: !configured
      ? "ANTHROPIC_API_KEY ontbreekt"
      : pricing === null
        ? `Geen prijsinformatie voor ${model}; voeg die toe in server/ai/providers/anthropic.ts`
        : undefined,
    async generateJSON({ system, user, schema, maxTokens, signal }) {
      if (!client) throw new ProviderError("Claude is niet geconfigureerd", "anthropic", true);
      try {
        const response = await client.beta.messages.parse(
          {
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: "user", content: user }],
            output_config: { effort: "medium", format: zodOutputFormat(schema) },
            // Server-side fallback bij een (onterechte) weigering door veiligheidsclassifiers.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          { signal },
        );
        if (response.stop_reason === "refusal") {
          throw new ProviderError("Claude heeft dit verzoek geweigerd.", "anthropic", true);
        }
        if (response.stop_reason === "max_tokens" || !response.parsed_output) {
          throw new ProviderError("Claude gaf een onvolledig antwoord.", "anthropic", true);
        }
        return {
          data: response.parsed_output,
          usage: {
            inputTokens:
              response.usage.input_tokens +
              (response.usage.cache_creation_input_tokens ?? 0) +
              (response.usage.cache_read_input_tokens ?? 0),
            outputTokens: response.usage.output_tokens,
          },
          model: response.model,
          provider: "anthropic",
        };
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
          throw new ProviderError("Claude API-sleutel ongeldig of zonder toegang.", "anthropic", true);
        }
        if (err instanceof Anthropic.BadRequestError) {
          throw new ProviderError(`Claude weigerde het verzoek: ${err.message}`, "anthropic", false);
        }
        if (err instanceof Anthropic.RateLimitError) {
          throw new ProviderError("Claude rate limit bereikt; probeer het later.", "anthropic", true);
        }
        if (err instanceof Anthropic.APIError) {
          throw new ProviderError(`Claude API-fout (${err.status ?? "netwerk"}).`, "anthropic", true);
        }
        throw err;
      }
    },
  };
}
