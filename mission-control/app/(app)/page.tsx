import { repo, serviceRepo } from "@/lib/db";
import { routeFor } from "@/lib/dispatch/adapters";
import { guardFor } from "@/lib/dispatch/dispatcher";
import { slidePath } from "@/lib/slides";
import { seoChecks, seoScore } from "@/lib/seo";
import { budgetState } from "@/lib/guardrails";
import { amsParts, startOfAmsDay, startOfAmsMonth } from "@/lib/time";
import { TodayClient, type CardData } from "@/components/today";

export const dynamic = "force-dynamic";

const MAX_CARDS = 20; // spelregel 5

function greeting(now: Date) {
  const h = amsParts(now).hour;
  return h < 12 ? "Goedemorgen" : h < 18 ? "Goedemiddag" : "Goedenavond";
}

export default async function TodayPage() {
  const r = await repo();
  const now = new Date();

  // Later-kaarten waarvan de dag is aangebroken, terug in de stapel.
  for (const s of await r.listInbox({ statuses: ["snoozed"] })) {
    if (s.snoozed_until && new Date(s.snoozed_until) <= now) await r.updateInboxItem(s.id, { status: "pending", snoozed_until: null });
  }

  const [all, settings, sentToday, spent, waiting, brain] = await Promise.all([
    r.listInbox({ statuses: ["pending"] }),
    r.getSettings(),
    r.sentCountSince(startOfAmsDay(now)),
    r.costSince(startOfAmsMonth(now)),
    r.listInbox({ statuses: ["approved", "scheduled"] }),
    r.getBrain(),
  ]);
  const visible = all.filter((i) => !i.visible_from || new Date(i.visible_from) <= now).slice(0, MAX_CARDS);

  const s = serviceRepo();
  const cards: CardData[] = await Promise.all(
    visible.map(async (item) => {
      const adapter = routeFor(item);
      const slideCount = item.type === "carousel" ? (item.payload.slides?.length ?? 0) : item.channel === "instagram" && item.type === "post" ? 1 : 0;
      let blocked: string | null = null;
      if (adapter.kind === "manual") {
        const d = await guardFor(s, { ...item, status: "approved", scheduled_at: null }, now);
        if (d.action === "block") blocked = d.reason;
      }
      return {
        item,
        slides: Array.from({ length: slideCount }, (_, i) => slidePath(item.id, i)),
        route: { kind: adapter.kind, label: adapter.label, ready: adapter.kind === "manual" || adapter.configured() },
        manual: adapter.manual ? adapter.manual(item) : null,
        blocked,
        seo: item.payload.blog
          ? (() => {
              const checks = seoChecks(item.payload.blog, brain.forbidden_words);
              return { score: seoScore(checks), checks };
            })()
          : null,
      };
    }),
  );

  const doneToday = Object.values(sentToday).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <TodayClient
      greeting={`${greeting(now)} Thysja`}
      cards={cards}
      doneToday={doneToday}
      waitingCount={waiting.length + all.filter((i) => i.visible_from && new Date(i.visible_from) > now).length}
      paused={settings.paused}
      budget={budgetState(spent, settings.monthly_budget_eur)}
    />
  );
}
