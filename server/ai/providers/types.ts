import type { z } from "zod";

export type ProviderId = "anthropic" | "openai";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface JSONResult<T> {
  data: T;
  usage: Usage;
  model: string;
  provider: ProviderId;
}

export interface Pricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface AIProvider {
  id: ProviderId;
  label: string;
  model: string;
  /** null = prijs onbekend → provider mag niet draaien (kosten zijn dan niet te bewaken). */
  pricing: Pricing | null;
  configured: boolean;
  configProblem?: string;
  generateJSON<S extends z.ZodType>(args: {
    system: string;
    user: string;
    schema: S;
    schemaName: string;
    maxTokens: number;
    signal?: AbortSignal;
  }): Promise<JSONResult<z.infer<S>>>;
}

/** Fout die we aan de gebruiker kunnen tonen, met indicatie of een andere provider zinvol is. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: ProviderId,
    public retryableElsewhere: boolean,
  ) {
    super(message);
  }
}
