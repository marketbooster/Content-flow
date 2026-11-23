// AI-modi: Snel (1 model), Slim (genereren + aparte kritische review) en Expert Council
// (Claude + OpenAI genereren onafhankelijk, reviewen elkaar, één synthese, max. één extra
// reviewronde). Alle resultaten komen van echte provider-aanroepen; er wordt niets gesimuleerd.
import { createHash, randomUUID } from "node:crypto";
import type { z } from "zod";
import { costOf, Ledger, type Store } from "./ledger";
import type { AIProvider, Attachment, ProviderId } from "./providers/types";
import { ProviderError } from "./providers/types";
import {
  type Brief, type BriefingExtract, BriefingExtractSchema, type BriefingRequest, type HookRequest, type Hooks, HooksSchema, type Proposal, ProposalSchema, type Review, ReviewSchema,
  type Synthesis, SynthesisSchema,
} from "./schemas";

export type HookResult = Hooks & { model: string; costUSD: number; cached?: boolean };
export type BriefingResult = BriefingExtract & { model: string; costUSD: number; cached?: boolean };

export type AIMode = "fast" | "smart" | "council";

export interface JobStep {
  name: string;
  kind: "proposal" | "review" | "synthesis";
  provider: ProviderId;
  model: string;
  reviewOf?: ProviderId;
  output?: Proposal | Review | Synthesis;
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

export interface Difference {
  topic: string;
  detail: string;
}

export interface AIJob {
  id: string;
  createdAt: string;
  mode: AIMode;
  brief: Brief;
  status: "klaar" | "mislukt";
  steps: JobStep[];
  differences: Difference[];
  final: Proposal | null;
  changeLog: { change: string; reason: string }[];
  openQuestions: string[];
  modelsUsed: string[];
  fallbackUsed: string | null;
  /** Consensus is geen bewijs: zonder externe check blijft dit 'niet_geverifieerd'. */
  verification: "niet_geverifieerd";
  totalCostUSD: number;
  error?: string;
  cached?: boolean;
}

export interface OrchestratorConfig {
  monthlyBudgetUSD: number;
  councilMonthlyLimit: number;
  maxTokens: number;
}

const CALLS_PER_MODE: Record<AIMode, number> = { fast: 1, smart: 3, council: 7 };

export class BudgetError extends Error {}

export class Orchestrator {
  constructor(
    private providers: Record<ProviderId, AIProvider>,
    private ledger: Ledger,
    private jobs: Store<AIJob[]>,
    private cfg: OrchestratorConfig,
  ) {}

  status() {
    return {
      providers: Object.values(this.providers).map((p) => ({
        id: p.id, label: p.label, model: p.model, configured: p.configured, problem: p.configProblem ?? null,
        pricing: p.pricing,
      })),
      budget: {
        monthlyBudgetUSD: this.cfg.monthlyBudgetUSD,
        spentUSD: round(this.ledger.monthSpendUSD()),
        councilRunsUsed: this.ledger.councilRunsThisMonth(),
        councilMonthlyLimit: this.cfg.councilMonthlyLimit,
      },
      modes: (["fast", "smart", "council"] as AIMode[]).map((m) => ({
        mode: m, maxCalls: CALLS_PER_MODE[m],
        // null = onbekend (prijs van een benodigde provider ontbreekt)
        worstCaseUSD: m === "council" && Object.values(this.providers).some((p) => !p.pricing)
          ? null : round(this.worstCase(m, this.providers.anthropic.pricing ? "anthropic" : "openai")),
      })),
    };
  }

  getJob(id: string): AIJob | undefined {
    return this.jobs.load().find((j) => j.id === id);
  }

  listJobs(limit = 20) {
    return this.jobs.load().slice(-limit).reverse().map((j) => ({
      id: j.id, createdAt: j.createdAt, mode: j.mode, status: j.status, title: j.final?.title ?? j.brief.task.slice(0, 80),
      totalCostUSD: j.totalCostUSD, modelsUsed: j.modelsUsed,
    }));
  }

  /** Bovengrens van de kosten: elke aanroep 4k input en max output-tokens. */
  private worstCase(mode: AIMode, primary: ProviderId): number {
    const p = (id: ProviderId) => this.providers[id].pricing ?? { inputPerMTok: 0, outputPerMTok: 0 };
    const usage = { inputTokens: 6000, outputTokens: this.cfg.maxTokens };
    if (mode !== "council") return CALLS_PER_MODE[mode] * costOf(usage, p(primary));
    const other: ProviderId = primary === "anthropic" ? "openai" : "anthropic";
    return 4 * costOf(usage, p(primary)) + 3 * costOf(usage, p(other));
  }

  private cacheKey(mode: AIMode, primary: ProviderId, brief: Brief) {
    return createHash("sha256").update(JSON.stringify({ mode, primary, brief })).digest("hex");
  }

  async run(mode: AIMode, brief: Brief, primary: ProviderId = "anthropic", signal?: AbortSignal): Promise<AIJob> {
    // Cache: identieke briefing binnen 24 uur → hergebruik (geen extra kosten).
    const key = this.cacheKey(mode, primary, brief);
    const recent = this.jobs.load().find(
      (j) => j.status === "klaar" && (j as AIJob & { key?: string }).key === key &&
        Date.now() - Date.parse(j.createdAt) < 24 * 3600_000,
    );
    if (recent) return { ...recent, cached: true };

    const secondary: ProviderId = primary === "anthropic" ? "openai" : "anthropic";
    if (mode === "council") {
      for (const id of [primary, secondary]) {
        if (!this.providers[id].configured) {
          throw new BudgetError(`Expert Council heeft beide providers nodig. ${this.providers[id].label}: ${this.providers[id].configProblem}`);
        }
      }
      if (this.ledger.councilRunsThisMonth() >= this.cfg.councilMonthlyLimit) {
        throw new BudgetError(`Maandlimiet voor Expert Council bereikt (${this.cfg.councilMonthlyLimit}).`);
      }
    }
    const usable = [primary, secondary].filter((id) => this.providers[id].configured);
    if (usable.length === 0) {
      throw new BudgetError("Geen AI-provider geconfigureerd. Zet API-sleutels in .env op de server.");
    }
    const spent = this.ledger.monthSpendUSD();
    const worst = this.worstCase(mode, usable[0]);
    if (spent + worst > this.cfg.monthlyBudgetUSD) {
      throw new BudgetError(
        `Maandbudget AI bijna op: $${spent.toFixed(2)} van $${this.cfg.monthlyBudgetUSD} gebruikt; deze modus kan tot $${worst.toFixed(2)} kosten.`,
      );
    }

    const job: AIJob & { key: string } = {
      id: randomUUID(), key, createdAt: new Date().toISOString(), mode, brief, status: "klaar", steps: [],
      differences: [], final: null, changeLog: [], openQuestions: [], modelsUsed: [], fallbackUsed: null,
      verification: "niet_geverifieerd", totalCostUSD: 0,
    };

    try {
      if (mode === "council") await this.runCouncil(job, primary, secondary, signal);
      else await this.runSingle(job, mode, usable, signal);
    } catch (err) {
      job.status = "mislukt";
      job.error = err instanceof Error ? err.message : String(err);
    }
    job.modelsUsed = [...new Set(job.steps.filter((s) => !s.error).map((s) => `${this.providers[s.provider].label} · ${s.model}`))];
    job.totalCostUSD = round(job.steps.reduce((s, x) => s + x.costUSD, 0));
    const all = this.jobs.load();
    all.push(job);
    this.jobs.save(all.slice(-500));
    return job;
  }

  // ───────── Losse, goedkope aanroepen (hooks, briefing) ─────────
  private singleCache = new Map<string, { at: number; result: unknown }>();

  private async singleCall<S extends z.ZodType>(opts: {
    step: string; system: string; user: string; schema: S; schemaName: string; maxTokens: number;
    primary: ProviderId; attachment?: Attachment; signal?: AbortSignal; cacheParts: unknown;
  }): Promise<z.infer<S> & { model: string; costUSD: number; cached?: boolean }> {
    type R = z.infer<S> & { model: string; costUSD: number; cached?: boolean };
    const key = createHash("sha256").update(JSON.stringify({ step: opts.step, p: opts.cacheParts, primary: opts.primary })).digest("hex");
    const hit = this.singleCache.get(key);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return { ...(hit.result as R), cached: true };

    const usable = ([opts.primary, opts.primary === "anthropic" ? "openai" : "anthropic"] as ProviderId[])
      .filter((id) => this.providers[id].configured);
    if (usable.length === 0) throw new BudgetError("Geen AI-provider geconfigureerd. Zet API-sleutels op de server.");
    const spent = this.ledger.monthSpendUSD();
    if (spent + this.worstCase("fast", usable[0]) > this.cfg.monthlyBudgetUSD) {
      throw new BudgetError(`Maandbudget AI bijna op: $${spent.toFixed(2)} van $${this.cfg.monthlyBudgetUSD} gebruikt.`);
    }
    const jobId = randomUUID();
    let lastErr: unknown;
    for (const pid of usable) {
      const p = this.providers[pid];
      try {
        const res = await p.generateJSON({
          system: opts.system, user: opts.user, schema: opts.schema, schemaName: opts.schemaName,
          maxTokens: opts.maxTokens, signal: opts.signal, attachment: opts.attachment,
        });
        const costUSD = p.pricing ? costOf(res.usage, p.pricing) : 0;
        this.ledger.record({
          at: new Date().toISOString(), jobId, step: opts.step, provider: pid, model: res.model,
          inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens, costUSD,
        });
        const result = { ...(res.data as object), model: `${p.label} · ${res.model}`, costUSD: round(costUSD) } as R;
        this.singleCache.set(key, { at: Date.now(), result });
        return result;
      } catch (err) {
        lastErr = err;
        if (!(err instanceof ProviderError && err.retryableElsewhere)) break;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`${opts.step} mislukt`);
  }

  hooks(req: HookRequest, primary: ProviderId = "anthropic", signal?: AbortSignal): Promise<HookResult> {
    return this.singleCall({
      step: "hooks", system: SYSTEM_HOOKS, user: hookPrompt(req), schema: HooksSchema, schemaName: "hooks",
      maxTokens: 8000, primary, signal, cacheParts: req,
    });
  }

  /** Briefing (tekst, PDF of afbeelding) -> shots met verplichte elementen. */
  briefing(req: BriefingRequest, primary: ProviderId = "anthropic", signal?: AbortSignal): Promise<BriefingResult> {
    const attachment = req.file ? { mediaType: req.file.mediaType, base64: req.file.base64, fileName: req.file.fileName } : undefined;
    return this.singleCall({
      step: "briefing", system: SYSTEM_BRIEFING, user: briefingPrompt(req), schema: BriefingExtractSchema, schemaName: "briefing",
      maxTokens: 12000, primary, signal, attachment,
      // Cache op inhoud, niet op het hele bestand (scheelt geheugen).
      cacheParts: { item: req.item, text: req.text, file: req.file && createHash("sha256").update(req.file.base64).digest("hex") },
    });
  }

  // ───────── Snel & Slim ─────────
  private async runSingle(job: AIJob, mode: "fast" | "smart", usable: ProviderId[], signal?: AbortSignal) {
    let pid = usable[0];
    let proposal: Proposal;
    try {
      proposal = await this.call(job, "genereren", "proposal", pid, ProposalSchema, "proposal", SYSTEM_CREATOR, briefPrompt(job.brief), signal);
    } catch (err) {
      // Provider-fallback: alleen bij fouten waar de andere provider iets aan kan doen.
      if (err instanceof ProviderError && err.retryableElsewhere && usable[1]) {
        job.fallbackUsed = `${this.providers[pid].label} faalde (${err.message}); overgeschakeld naar ${this.providers[usable[1]].label}.`;
        pid = usable[1];
        proposal = await this.call(job, "genereren (fallback)", "proposal", pid, ProposalSchema, "proposal", SYSTEM_CREATOR, briefPrompt(job.brief), signal);
      } else throw err;
    }
    job.final = proposal;
    if (mode === "fast") return;

    const review = await this.call(job, "kritische review", "review", pid, ReviewSchema, "review", SYSTEM_REVIEWER, reviewPrompt(job.brief, proposal), signal, pid);
    if (review.verdict === "sterk" && review.possibleErrors.length === 0) return;
    const syn = await this.call(job, "verbeteren", "synthesis", pid, SynthesisSchema, "synthesis", SYSTEM_SYNTH, revisePrompt(job.brief, proposal, [review]), signal);
    applySynthesis(job, syn);
  }

  // ───────── Expert Council ─────────
  private async runCouncil(job: AIJob, a: ProviderId, b: ProviderId, signal?: AbortSignal) {
    // Stap 1–2: gedeelde briefing, onafhankelijke voorstellen (parallel).
    const [pa, pb] = await Promise.all([
      this.call(job, "council: voorstel", "proposal", a, ProposalSchema, "proposal", SYSTEM_CREATOR, briefPrompt(job.brief), signal),
      this.call(job, "council: voorstel", "proposal", b, ProposalSchema, "proposal", SYSTEM_CREATOR, briefPrompt(job.brief), signal),
    ]);
    // Stap 3: kruislingse review (anoniem: "voorstel X", zodat merk geen rol speelt).
    const [ra, rb] = await Promise.all([
      this.call(job, "council: review", "review", b, ReviewSchema, "review", SYSTEM_REVIEWER, reviewPrompt(job.brief, pa), signal, a),
      this.call(job, "council: review", "review", a, ReviewSchema, "review", SYSTEM_REVIEWER, reviewPrompt(job.brief, pb), signal, b),
    ]);
    // Stap 4: verschillen, risico's en ontbrekende gegevens (deterministisch, in code).
    job.differences = diffProposals(pa, pb, ra, rb, this.providers[a].label, this.providers[b].label);
    // Stap 5: synthese door het primaire model…
    let syn = await this.call(job, "council: synthese", "synthesis", a, SynthesisSchema, "synthesis", SYSTEM_SYNTH,
      synthPrompt(job.brief, [pa, pb], [ra, rb], job.differences), signal);
    applySynthesis(job, syn);
    // …met maximaal één aanvullende kritische reviewronde door het andere model.
    const final = await this.call(job, "council: eindreview", "review", b, ReviewSchema, "review", SYSTEM_REVIEWER,
      reviewPrompt(job.brief, syn.proposal), signal, a);
    if (final.possibleErrors.length > 0 || final.verdict === "zwak") {
      syn = await this.call(job, "council: laatste verbetering", "synthesis", a, SynthesisSchema, "synthesis", SYSTEM_SYNTH,
        revisePrompt(job.brief, syn.proposal, [final]), signal);
      applySynthesis(job, syn);
    }
    // Stap 6: externe feitencontrole (voedingswaarden, trends, prijzen) gebeurt NIET door AI-consensus;
    // de te controleren punten staan in final.factChecksNeeded en de status blijft 'niet_geverifieerd'.
  }

  private async call<S extends z.ZodType>(
    job: AIJob, name: string, kind: JobStep["kind"], pid: ProviderId, schema: S, schemaName: string,
    system: string, user: string, signal?: AbortSignal, reviewOf?: ProviderId,
  ): Promise<z.infer<S>> {
    const p = this.providers[pid];
    const step: JobStep = { name, kind, provider: pid, model: p.model, reviewOf, costUSD: 0, inputTokens: 0, outputTokens: 0 };
    job.steps.push(step);
    try {
      const res = await p.generateJSON({ system, user, schema, schemaName, maxTokens: this.cfg.maxTokens, signal });
      step.model = res.model;
      step.output = res.data as JobStep["output"];
      step.inputTokens = res.usage.inputTokens;
      step.outputTokens = res.usage.outputTokens;
      step.costUSD = p.pricing ? costOf(res.usage, p.pricing) : 0;
      this.ledger.record({
        at: new Date().toISOString(), jobId: job.id, step: name, provider: pid, model: res.model,
        inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens, costUSD: step.costUSD,
      });
      return res.data;
    } catch (err) {
      step.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }
}

function applySynthesis(job: AIJob, syn: Synthesis) {
  job.final = syn.proposal;
  job.changeLog.push(...syn.changeLog);
  job.openQuestions = [...new Set([...job.openQuestions, ...syn.openQuestions])];
}

export function diffProposals(pa: Proposal, pb: Proposal, ra: Review, rb: Review, la: string, lb: string): Difference[] {
  const d: Difference[] = [];
  if (pa.format !== pb.format) d.push({ topic: "Format", detail: `${la}: ${pa.format} · ${lb}: ${pb.format}` });
  if (pa.pillar !== pb.pillar) d.push({ topic: "Contentpijler", detail: `${la}: ${pa.pillar} · ${lb}: ${pb.pillar}` });
  const t = Math.abs(pa.estimatedProductionMinutes - pb.estimatedProductionMinutes);
  if (t >= 30) d.push({ topic: "Productietijd", detail: `${la}: ${pa.estimatedProductionMinutes} min · ${lb}: ${pb.estimatedProductionMinutes} min` });
  const keys = Object.keys(ra.scores) as (keyof Review["scores"])[];
  for (const k of keys) {
    const diff = ra.scores[k] - rb.scores[k];
    if (Math.abs(diff) >= 2) d.push({ topic: `Score ${k}`, detail: `voorstel ${la}: ${ra.scores[k]}/5 · voorstel ${lb}: ${rb.scores[k]}/5` });
  }
  const missing = [...new Set([...pa.missingData, ...pb.missingData, ...ra.missingData, ...rb.missingData])];
  if (missing.length) d.push({ topic: "Ontbrekende gegevens", detail: missing.join("; ") });
  const risks = [...new Set([...ra.risks, ...rb.risks, ...ra.possibleErrors, ...rb.possibleErrors])];
  if (risks.length) d.push({ topic: "Risico's en mogelijke fouten", detail: risks.join("; ") });
  return d;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

// ───────── Prompts ─────────
const SHARED_RULES = `Regels (altijd):
- Schrijf in het Nederlands, in de merkstem van de creator.
- Verzin geen feiten, trends, viral-scores, prijzen, kortingen of prestatiecijfers. Zonder aangeleverde accountgegevens doe je geen uitspraken over verwachte prestaties.
- Noem GEEN calorieën of voedingswaarden als feit. Voedingswaarden worden later berekend uit de echte ingrediënten; zet dit in factChecksNeeded.
- Geen medische claims of advies (zeker bij PCOS); framing is persoonlijke ervaring en verwijs waar nodig naar huisarts/diëtist.
- Geen crash-diëten, compensatiegedrag of schuldgevoel-taal.
- Benoem aannames (assumptions), ontbrekende gegevens (missingData) en punten die extern gecontroleerd moeten worden (factChecksNeeded).
- Recept: geef exacte hoeveelheden per ingrediënt en heldere stappen; anders recipe = null.`;

const SYSTEM_CREATOR = `Je bent een senior contentstrateeg en receptontwikkelaar voor een Nederlandse creator. Je levert één concreet, origineel en uitvoerbaar contentvoorstel: hook, concept, script, caption, shotlist en (indien relevant) recept.
${SHARED_RULES}`;

const SYSTEM_REVIEWER = `Je bent een kritische, eerlijke reviewer van contentvoorstellen. Je beoordeelt zonder te weten welk model het voorstel schreef. Wees streng op feitelijke fouten, onrealistische hoeveelheden of bereidingen, merkstem, uitvoerbaarheid en commerciële/juridische risico's (o.a. reclame-labeling). Geef scores van 1 t/m 5. Zet performanceDataUsed alleen op true als er echte accountgegevens in de briefing stonden.
${SHARED_RULES}`;

const SYSTEM_SYNTH = `Je bent de eindredacteur. Je combineert de sterkste elementen tot één verbeterd voorstel en verwerkt de reviewpunten. Leg elke wezenlijke wijziging vast in changeLog (wat en waarom). Los tegenstrijdigheden expliciet op of zet ze in openQuestions voor de creator. Twee modellen die het eens zijn, hebben niet automatisch gelijk.
${SHARED_RULES}`;

const SYSTEM_HOOKS = `Je bent een scherpe short-form copywriter voor een Nederlandse creator. Je schrijft hooks voor de eerste 1–2 seconden van een video: kort (max. ±12 woorden), concreet, nieuwsgierig makend, in de merkstem. Lever 5 hooks met elk een andere invalshoek (bv. herkenning, tegenstelling, resultaat, vraag, humor), plus één caption met duidelijke call-to-action en 8–15 relevante Nederlandstalige en Engelstalige hashtags (zonder spaties, met #).
${SHARED_RULES}
- Geen clickbait die de video niet waarmaakt. Noem geen calorieën als feit.
- Is dit een betaalde samenwerking, zet dan #ad of 'betaalde samenwerking' in de caption en noem dat in notes.`;

const SYSTEM_BRIEFING = `Je zet een merkbriefing om in een opnameplan voor een Nederlandse creator. Lees de briefing (tekst, PDF of afbeelding) zorgvuldig en verdeel de video in logische shots in de volgorde van filmen.
Per shot: een korte titel (wat je filmt), wat de creator zegt of als tekst in beeld zet (say; leeg als niet van toepassing), en de verplichte elementen uit de briefing die in dát shot moeten (mustInclude: product in beeld, claims, logo, kortingscode, links).
Zet elementen die voor de hele video gelden (bv. #ad, @merk, kortingscode, verplichte hashtags) in alwaysInclude. Do's en don'ts apart. Deadlines letterlijk overnemen.
Regels:
- Neem alleen over wat in de briefing staat; verzin geen claims, codes of merknamen. Wat onduidelijk of tegenstrijdig is, zet je in unclear.
- Formuleer kort en scanbaar: de creator leest dit van een scherm tijdens het filmen.
- Schrijf in het Nederlands, ook als de briefing Engelstalig is (merk- en productnamen ongewijzigd).
- Bevat de briefing geen betaalde-samenwerking-vermelding maar is het wel een deal, noem dan in unclear dat labeling (#ad) nodig is.`;

function briefingPrompt(r: BriefingRequest): string {
  return [
    `VIDEO: ${r.item.title} (${r.item.format})`,
    r.file ? `De briefing staat in het bijgevoegde bestand${r.file.fileName ? ` (${r.file.fileName})` : ""}.` : null,
    r.text?.trim() ? `BRIEFINGTEKST:\n${r.text.trim()}` : null,
  ].filter(Boolean).join("\n\n");
}

function hookPrompt(r: HookRequest): string {
  return [
    `CREATOR: ${r.creator.name}`,
    `MERKSTEM: ${r.creator.brandVoice}`,
    `DOELGROEP: ${r.creator.audience}`,
    `IDEE: ${r.item.title}`,
    r.item.hook ? `HUIDIGE HOOK: ${r.item.hook}` : null,
    r.item.description ? `OMSCHRIJVING: ${r.item.description}` : null,
    `FORMAT: ${r.item.format} · PIJLER: ${r.item.pillar}`,
  ].filter(Boolean).join("\n");
}

function briefPrompt(b: Brief): string {
  return [
    `OPDRACHT: ${b.task}`,
    `CREATOR: ${b.creator.name}`,
    `MERKSTEM: ${b.creator.brandVoice}`,
    `DOELGROEP: ${b.creator.audience}`,
    `CONTENTPIJLERS: ${b.creator.pillars.join(", ")}`,
    b.event ? `MOMENT: ${b.event.name} (${b.event.date})` : null,
    b.idea ? `STARTIDEE: ${JSON.stringify(b.idea)}` : null,
    `PRESTATIEGEGEVENS: ${b.performanceData ?? "niet beschikbaar — doe geen prestatievoorspellingen"}`,
    b.constraints?.length ? `RANDVOORWAARDEN:\n- ${b.constraints.join("\n- ")}` : null,
  ].filter(Boolean).join("\n");
}

function reviewPrompt(b: Brief, p: Proposal): string {
  return `${briefPrompt(b)}\n\nTE BEOORDELEN VOORSTEL:\n${JSON.stringify(p, null, 2)}`;
}

function revisePrompt(b: Brief, p: Proposal, reviews: Review[]): string {
  return `${briefPrompt(b)}\n\nHUIDIG VOORSTEL:\n${JSON.stringify(p, null, 2)}\n\nREVIEW(S):\n${JSON.stringify(reviews, null, 2)}\n\nVerbeter het voorstel op basis van de review. Dit is de laatste ronde.`;
}

function synthPrompt(b: Brief, ps: Proposal[], rs: Review[], diffs: Difference[]): string {
  return `${briefPrompt(b)}\n\nVOORSTEL A:\n${JSON.stringify(ps[0], null, 2)}\n\nREVIEW VAN A:\n${JSON.stringify(rs[0], null, 2)}\n\nVOORSTEL B:\n${JSON.stringify(ps[1], null, 2)}\n\nREVIEW VAN B:\n${JSON.stringify(rs[1], null, 2)}\n\nGEVONDEN VERSCHILLEN:\n${JSON.stringify(diffs, null, 2)}\n\nMaak één verbeterde synthese.`;
}
