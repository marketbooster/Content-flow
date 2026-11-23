// Gestructureerde in- en output van de AI-stappen. Beide providers leveren exact deze vorm
// (structured outputs), zodat voorstellen naast elkaar te vergelijken zijn.
import { z } from "zod";

export const PILLARS = [
  "afvallen", "recepten", "fitness", "pcos", "moederschap", "humor", "ontwikkeling", "samenwerkingen",
] as const;
export const FORMATS = ["reel", "tiktok", "carrousel", "story", "post", "live", "blog"] as const;

export const BriefSchema = z.object({
  task: z.string().min(5).max(2000),
  creator: z.object({
    name: z.string().max(100),
    brandVoice: z.string().max(1000),
    audience: z.string().max(1000),
    pillars: z.array(z.string().max(100)).max(12),
  }),
  event: z.object({ name: z.string().max(200), date: z.string().max(40) }).nullable().optional(),
  idea: z
    .object({
      title: z.string().max(300),
      hook: z.string().max(500).optional(),
      description: z.string().max(2000).optional(),
      format: z.enum(FORMATS).optional(),
      pillar: z.enum(PILLARS).optional(),
    })
    .nullable()
    .optional(),
  /** Alleen echte accountgegevens; null = niet beschikbaar (AI mag dan niets verzinnen). */
  performanceData: z.string().max(4000).nullable().optional(),
  constraints: z.array(z.string().max(300)).max(20).optional(),
});
export type Brief = z.infer<typeof BriefSchema>;

export const ProposalSchema = z.object({
  title: z.string(),
  hook: z.string(),
  format: z.enum(FORMATS),
  pillar: z.enum(PILLARS),
  concept: z.string(),
  script: z.string(),
  caption: z.string(),
  shotlist: z.array(z.string()),
  recipe: z
    .object({
      servings: z.number(),
      ingredients: z.array(z.object({ item: z.string(), amount: z.number(), unit: z.string() })),
      steps: z.array(z.string()),
    })
    .nullable(),
  estimatedProductionMinutes: z.number(),
  assumptions: z.array(z.string()),
  missingData: z.array(z.string()),
  factChecksNeeded: z.array(z.string()),
});
export type Proposal = z.infer<typeof ProposalSchema>;

const score = z.number().describe("1 (zwak) t/m 5 (uitstekend)");
export const ReviewSchema = z.object({
  scores: z.object({
    originaliteit: score,
    doelgroeprelevantie: score,
    merkstem: score,
    uitvoerbaarheid: score,
    creatieveKwaliteit: score,
    commercieleGeschiktheid: score,
  }),
  estimatedProductionMinutes: z.number(),
  performanceDataUsed: z.boolean(),
  strengths: z.array(z.string()),
  possibleErrors: z.array(z.string()),
  risks: z.array(z.string()),
  missingData: z.array(z.string()),
  improvements: z.array(z.string()),
  verdict: z.enum(["sterk", "bruikbaar", "zwak"]),
});
export type Review = z.infer<typeof ReviewSchema>;

export const HookRequestSchema = z.object({
  creator: BriefSchema.shape.creator,
  item: z.object({
    title: z.string().min(2).max(300),
    hook: z.string().max(500).optional(),
    description: z.string().max(2000).optional(),
    format: z.enum(FORMATS),
    pillar: z.enum(PILLARS),
  }),
});
export type HookRequest = z.infer<typeof HookRequestSchema>;

export const HooksSchema = z.object({
  hooks: z.array(z.object({ hook: z.string(), angle: z.string() })),
  caption: z.string(),
  hashtags: z.array(z.string()),
  notes: z.array(z.string()),
});
export type Hooks = z.infer<typeof HooksSchema>;

const MAX_FILE_BASE64 = 14_000_000; // ± 10 MB bestand
export const BriefingRequestSchema = z.object({
  item: z.object({ title: z.string().min(1).max(300), format: z.enum(FORMATS) }),
  text: z.string().max(30_000).optional(),
  file: z.object({
    mediaType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]),
    base64: z.string().min(10).max(MAX_FILE_BASE64),
    fileName: z.string().max(200).optional(),
  }).optional(),
}).refine((r) => Boolean(r.text?.trim()) || Boolean(r.file), { message: "Geef tekst of een bestand mee." });
export type BriefingRequest = z.infer<typeof BriefingRequestSchema>;

export const BriefingExtractSchema = z.object({
  shots: z.array(z.object({
    title: z.string(),
    say: z.string(),
    mustInclude: z.array(z.string()),
    notes: z.string(),
  })),
  alwaysInclude: z.array(z.string()),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
  deadlines: z.array(z.string()),
  unclear: z.array(z.string()),
});
export type BriefingExtract = z.infer<typeof BriefingExtractSchema>;

export const SynthesisSchema = z.object({
  proposal: ProposalSchema,
  changeLog: z.array(z.object({ change: z.string(), reason: z.string() })),
  resolvedDisagreements: z.array(z.string()),
  openQuestions: z.array(z.string()),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;
