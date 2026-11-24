import { repo } from "@/lib/db";
import { ADAPTERS } from "@/lib/dispatch/adapters";
import { AGENT_INFO, AGENT_SCHEDULE } from "@/lib/agents/runner";
import { aiConfigured, MODEL_SCAN, MODEL_WRITE } from "@/lib/ai";
import { budgetState } from "@/lib/guardrails";
import { startOfAmsMonth } from "@/lib/time";
import { AGENTS } from "@/lib/types";
import { ProfileClient } from "@/components/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const r = await repo();
  const [brain, settings, runs, spent, log, suppression] = await Promise.all([
    r.getBrain(),
    r.getSettings(),
    r.listRuns(30),
    r.costSince(startOfAmsMonth(new Date())),
    r.listDispatchLog(30),
    r.listSuppression(),
  ]);

  const linkedInRoute = process.env.LINKEDIN_ROUTE === "share_api" ? ADAPTERS.linkedInShare : ADAPTERS.bufferLinkedIn;
  const connections = [
    { name: "Claude API", ok: aiConfigured(), detail: aiConfigured() ? `Schrijven: ${MODEL_WRITE} · scannen: ${MODEL_SCAN}` : "ANTHROPIC_API_KEY ontbreekt (Creator draait nu met demo-ideeën)" },
    ...[linkedInRoute, ADAPTERS.instagram].map((a) => ({
      name: a.label,
      ok: a.configured(),
      detail: a.configured() ? "Gekoppeld" : `Ontbreekt: ${a.missing().join(", ")}`,
    })),
    ...[ADAPTERS.gmail, ADAPTERS.brevo, ADAPTERS.blog, ADAPTERS.print].map((a) => ({ name: a.label, ok: false, detail: "Nog niet gekoppeld" })),
  ];

  const agents = AGENTS.map((name) => {
    const last = runs.find((x) => x.agent === name) ?? null;
    return {
      name,
      ...AGENT_INFO[name],
      schedule: AGENT_SCHEDULE[name].label,
      sprint: AGENT_SCHEDULE[name].sprint,
      built: name === "creator",
      cron: Boolean(settings.cron_enabled[name]),
      testedManually: runs.some((x) => x.agent === name && x.trigger === "manual" && x.status === "ok"),
      last,
    };
  });

  return (
    <ProfileClient
      brain={brain}
      settings={settings}
      agents={agents}
      runs={runs}
      spent={spent}
      budget={budgetState(spent, settings.monthly_budget_eur)}
      connections={connections}
      log={log}
      suppression={suppression}
    />
  );
}
