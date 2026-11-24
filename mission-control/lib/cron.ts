import "server-only";
import type { Repo } from "./db/repo";
import { dispatchDue } from "./dispatch/dispatcher";
import { produceAsset, runCreatorIdeas } from "./agents/creator";
import { AGENT_SCHEDULE } from "./agents/runner";
import { amsParts, startOfAmsDay, amsDayAt } from "./time";
import type { AgentName } from "./types";

/** Agents die in deze sprint gebouwd zijn. */
const IMPLEMENTED: Partial<Record<AgentName, (repo: Repo) => Promise<unknown>>> = {
  creator: (repo) => runCreatorIdeas(repo, "cron"),
};

export function isDue(agent: AgentName, now: Date, lastCronRunToday: boolean): boolean {
  const s = AGENT_SCHEDULE[agent];
  const p = amsParts(now);
  if (s.weekdays && !s.weekdays.includes(p.weekday)) return false;
  if (p.hour * 60 + p.minute < s.hour * 60 + s.minute) return false;
  return !lastCronRunToday;
}

export async function tick(repo: Repo, now = new Date()) {
  const report: Record<string, unknown> = {};

  // 1. Later-kaarten terug in de stapel
  const snoozed = await repo.listInbox({ statuses: ["snoozed"] });
  let woke = 0;
  for (const i of snoozed) {
    if (i.snoozed_until && new Date(i.snoozed_until) <= now) {
      await repo.updateInboxItem(i.id, { status: "pending", snoozed_until: null });
      woke++;
    }
  }
  report.woke = woke;

  // 2. Verzenden wat aan de beurt is
  report.dispatched = await dispatchDue(repo, now);

  // 3. Agents op schema (alleen als je ze aangezet hebt)
  const settings = await repo.getSettings();
  const runs = await repo.listRuns(50);
  const today = startOfAmsDay(now);
  const ran: string[] = [];
  if (!settings.paused) {
    for (const [agent, fn] of Object.entries(IMPLEMENTED) as [AgentName, (r: Repo) => Promise<unknown>][]) {
      if (!settings.cron_enabled[agent]) continue;
      const already = runs.some((r) => r.agent === agent && r.trigger === "cron" && new Date(r.started_at) >= today);
      if (!isDue(agent, now, already)) continue;
      try {
        await fn(repo);
        ran.push(agent);
      } catch (err) {
        ran.push(`${agent}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  report.agents = ran;

  // 4. Kalenderposts die nog niet afgemaakt zijn (bijv. na een fout)
  const pending = (await repo.listCalendar(today, amsDayAt(now, 21, 0, 0))).filter(
    (c) => c.status === "planned" && !c.inbox_item_id,
  );
  for (const entry of pending.slice(0, 3)) {
    try {
      await produceAsset(repo, entry, "cron");
    } catch {
      /* status staat op failed; zichtbaar in de kalender */
    }
  }
  report.produced = Math.min(pending.length, 3);
  return report;
}
