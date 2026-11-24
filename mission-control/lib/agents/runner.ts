import "server-only";
import type { Repo } from "../db/repo";
import type { AgentName, AgentRun } from "../types";
import { budgetState } from "../guardrails";
import { amsMonthKey, startOfAmsMonth } from "../time";
import { ZERO_USAGE, type Usage } from "../ai";

export interface RunResult {
  usage: Usage;
  itemsCreated: number;
}

export class AgentBlocked extends Error {}

/** Vaste agenda (Europe/Amsterdam). weekday: 1 = ma … 5 = vr; leeg = elke dag. */
export const AGENT_SCHEDULE: Record<AgentName, { hour: number; minute: number; weekdays?: number[]; label: string; sprint: number }> = {
  scout: { hour: 5, minute: 0, label: "dagelijks 05:00", sprint: 4 },
  hunter: { hour: 5, minute: 30, label: "dagelijks 05:30", sprint: 3 },
  ranker: { hour: 5, minute: 0, weekdays: [1], label: "ma 05:00", sprint: 4 },
  creator: { hour: 6, minute: 0, label: "dagelijks 06:00", sprint: 1 },
  listener: { hour: 6, minute: 30, label: "dagelijks 06:30", sprint: 2 },
  nurturer: { hour: 7, minute: 0, label: "dagelijks 07:00", sprint: 2 },
  analyst: { hour: 16, minute: 0, weekdays: [5], label: "vr 16:00", sprint: 5 },
  chief: { hour: 7, minute: 15, label: "dagelijks 07:15", sprint: 5 },
};

export const AGENT_INFO: Record<AgentName, { title: string; job: string }> = {
  scout: { title: "Scout", job: "Kansen-radar: nieuws, vacatures, vragen" },
  hunter: { title: "Hunter", job: "Acquisitie: 10 persoonlijke benaderingen" },
  ranker: { title: "Ranker", job: "SEO: blog, pagina-update of linkpitch" },
  creator: { title: "Creator", job: "Social: 10 ideeën en afgemaakte posts" },
  listener: { title: "Listener", job: "Engagement: reacties en DM's" },
  nurturer: { title: "Nurturer", job: "E-mail: opvolging en nieuwsbrief" },
  analyst: { title: "Analyst", job: "Weekrapport en bijsturing" },
  chief: { title: "Chief", job: "Ochtendbriefing: top 20" },
};

/**
 * Elke agent-run gaat hierdoor: noodknop, maandplafond, logging van tokens en kosten.
 */
export async function runAgent(
  repo: Repo,
  agent: AgentName,
  trigger: AgentRun["trigger"],
  fn: (run: AgentRun) => Promise<RunResult>,
): Promise<AgentRun> {
  const settings = await repo.getSettings();
  if (settings.paused) throw new AgentBlocked("Alles staat op pauze.");
  const spent = await repo.costSince(startOfAmsMonth(new Date()));
  const state = budgetState(spent, settings.monthly_budget_eur);
  if (state === "stop") {
    throw new AgentBlocked(`Maandplafond bereikt (€${spent.toFixed(2)} van €${settings.monthly_budget_eur}). Verhoog het plafond om door te gaan.`);
  }

  const run = await repo.startRun(agent, trigger);
  try {
    const result = await fn(run);
    await repo.finishRun(run.id, {
      status: "ok",
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      cost_eur: result.usage.costEur,
      items_created: result.itemsCreated,
    });
    // Melding bij 80%: één keer per maand een vlag; Vandaag toont de banner.
    const after = spent + result.usage.costEur;
    if (budgetState(after, settings.monthly_budget_eur) !== "ok" && settings.budget_warned_month !== amsMonthKey(new Date())) {
      await repo.saveSettings({ budget_warned_month: amsMonthKey(new Date()) });
    }
    return { ...run, status: "ok", ...result };
  } catch (err) {
    await repo.finishRun(run.id, { status: "error", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export const noUsage = (itemsCreated: number): RunResult => ({ usage: ZERO_USAGE, itemsCreated });
