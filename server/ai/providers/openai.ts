import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import type { AIProvider, Pricing } from "./types";
import { ProviderError } from "./types";

// Het model en de prijzen worden bewust NIET hardcoded: stel OPENAI_MODEL en de prijzen
// (platform.openai.com/docs/pricing) in via .env. Zonder prijs draait OpenAI niet, omdat
// de kosten dan niet te bewaken zijn.
export function createOpenAIProvider(env: NodeJS.ProcessEnv, timeoutMs: number): AIProvider {
  const model = env.OPENAI_MODEL || "";
  const inP = Number(env.OPENAI_INPUT_USD_PER_MTOK);
  const outP = Number(env.OPENAI_OUTPUT_USD_PER_MTOK);
  const pricing: Pricing | null =
    Number.isFinite(inP) && Number.isFinite(outP) && inP > 0 && outP > 0
      ? { inputPerMTok: inP, outputPerMTok: outP }
      : null;
  const hasKey = Boolean(env.OPENAI_API_KEY);
  const client = hasKey ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: timeoutMs, maxRetries: 2 }) : null;
  const configProblem = !hasKey
    ? "OPENAI_API_KEY ontbreekt"
    : !model
      ? "OPENAI_MODEL ontbreekt"
      : !pricing
        ? "OPENAI_INPUT_USD_PER_MTOK / OPENAI_OUTPUT_USD_PER_MTOK ontbreken"
        : undefined;

  return {
    id: "openai",
    label: "OpenAI",
    model: model || "(niet ingesteld)",
    pricing,
    configured: !configProblem,
    configProblem,
    async generateJSON({ system, user, schema, schemaName, maxTokens, signal, attachment }) {
      if (!client || configProblem) throw new ProviderError(`OpenAI is niet geconfigureerd: ${configProblem}`, "openai", true);
      try {
        const response = await client.responses.parse(
          {
            model,
            instructions: system,
            input: attachment
              ? [{
                  role: "user",
                  content: [
                    attachment.mediaType === "application/pdf"
                      ? { type: "input_file", filename: attachment.fileName ?? "briefing.pdf", file_data: `data:application/pdf;base64,${attachment.base64}` }
                      : { type: "input_image", detail: "auto", image_url: `data:${attachment.mediaType};base64,${attachment.base64}` },
                    { type: "input_text", text: user },
                  ],
                }]
              : user,
            max_output_tokens: maxTokens,
            text: { format: zodTextFormat(schema, schemaName) },
          },
          { signal },
        );
        if (response.status === "incomplete" || !response.output_parsed) {
          throw new ProviderError("OpenAI gaf een onvolledig of geweigerd antwoord.", "openai", true);
        }
        return {
          data: response.output_parsed as z.infer<typeof schema>,
          usage: {
            inputTokens: response.usage?.input_tokens ?? 0,
            outputTokens: response.usage?.output_tokens ?? 0,
          },
          model: response.model,
          provider: "openai",
        };
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) {
          throw new ProviderError("OpenAI API-sleutel ongeldig of zonder toegang.", "openai", true);
        }
        if (err instanceof OpenAI.BadRequestError) {
          throw new ProviderError(`OpenAI weigerde het verzoek: ${err.message}`, "openai", false);
        }
        if (err instanceof OpenAI.RateLimitError) {
          throw new ProviderError("OpenAI rate limit of tegoed bereikt.", "openai", true);
        }
        if (err instanceof OpenAI.APIError) {
          throw new ProviderError(`OpenAI API-fout (${err.status ?? "netwerk"}).`, "openai", true);
        }
        throw err;
      }
    },
  };
}
