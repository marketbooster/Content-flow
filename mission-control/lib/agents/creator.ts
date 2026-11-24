import "server-only";
import { z } from "zod";
import type { Repo } from "../db/repo";
import type { CalendarEntry, ContentIdea, InboxItem, ItemPayload } from "../types";
import { aiConfigured, callStructured, loadPrompt, MODEL_WRITE } from "../ai";
import { noUsage, runAgent, type RunResult } from "./runner";
import { formatDayTime, startOfAmsDay } from "../time";

// ── Schema's (structured outputs) ─────────────────────────────────────
const IdeaSchema = z.object({
  hook: z.string(),
  angle: z.string(),
  format: z.enum(["post", "carousel", "reel"]),
  channel: z.enum(["linkedin", "instagram"]),
  pillar: z.string(),
  tags: z.array(z.string()),
});
const IdeasSchema = z.object({ ideas: z.array(IdeaSchema) });

const SlideSchema = z.object({ title: z.string(), body: z.string() });
const ReelSchema = z.object({
  hook: z.string(),
  shots: z.array(z.object({ visual: z.string(), voiceover: z.string() })),
  subtitles: z.array(z.string()),
  cta: z.string(),
});
const AssetSchema = z.object({
  title: z.string(),
  body: z.string(),
  first_comment: z.string(),
  hashtags: z.array(z.string()),
  slides: z.array(SlideSchema).nullable(),
  reel: ReelSchema.nullable(),
});
const RewriteSchema = z.object({
  body: z.string(),
  first_comment: z.string().nullable(),
  slides: z.array(SlideSchema).nullable(),
});

// ── 1. Dagelijkse swipe-stapel ────────────────────────────────────────
export async function runCreatorIdeas(repo: Repo, trigger: "manual" | "cron") {
  return runAgent(repo, "creator", trigger, async (run): Promise<RunResult> => {
    const brain = await repo.getBrain();
    const recent = await repo.listIdeas(["new", "accepted", "rejected", "today"], 60);

    if (!aiConfigured()) {
      const created = await repo.createIdeas(demoIdeas(brain.contentbank, brain.pillars).map((i) => ({ ...i, run_id: run.id })));
      return noUsage(created.length);
    }

    const task = [
      `Datum: ${new Date().toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "full" })}`,
      `Contentbank (open onderwerpen):\n${brain.contentbank.map((c) => `- ${c}`).join("\n") || "(leeg)"}`,
      `Recente ideeën (niet herhalen; status tussen haakjes):\n${recent.map((i) => `- ${i.hook} (${i.status}${i.reject_reason ? `: ${i.reject_reason}` : ""})`).join("\n") || "(geen)"}`,
      "Lever nu precies 10 ideeën.",
    ].join("\n\n");

    const { data, usage } = await callStructured({
      agentPrompt: loadPrompt("creator-ideas"),
      brain,
      task,
      schema: IdeasSchema,
      model: MODEL_WRITE,
      effort: "medium",
    });
    const created = await repo.createIdeas(
      data.ideas.slice(0, 10).map((i) => ({ ...i, status: "new" as const, reject_reason: null, run_id: run.id })),
    );
    return { usage, itemsCreated: created.length };
  });
}

// ── 2. Afmaken na goedkeuring ─────────────────────────────────────────
export async function produceAsset(repo: Repo, entry: CalendarEntry, trigger: "manual" | "cron" = "manual") {
  await repo.updateCalendarEntry(entry.id, { status: "producing" });
  try {
    let itemId = "";
    await runAgent(repo, "creator", trigger, async (): Promise<RunResult> => {
      const brain = await repo.getBrain();
      let asset: z.infer<typeof AssetSchema>;
      let result: RunResult;
      if (!aiConfigured()) {
        asset = demoAsset(entry);
        result = noUsage(1);
      } else {
        const { data, usage } = await callStructured({
          agentPrompt: loadPrompt("creator-asset"),
          brain,
          task: [
            `Kanaal: ${entry.channel}`,
            `Format: ${entry.format}`,
            `Pijler: ${entry.pillar}`,
            `Hook: ${entry.hook}`,
            entry.tags.length ? `Tags: ${entry.tags.join(", ")}` : "",
            `Gepland: ${formatDayTime(entry.slot_at)}`,
          ]
            .filter(Boolean)
            .join("\n"),
          schema: AssetSchema,
          model: MODEL_WRITE,
          effort: "medium",
        });
        asset = data;
        result = { usage, itemsCreated: 1 };
      }

      const payload: ItemPayload = {
        first_comment: asset.first_comment || undefined,
        hashtags: asset.hashtags,
        slides: entry.format === "carousel" ? (asset.slides ?? undefined) : undefined,
        reel: entry.format === "reel" ? (asset.reel ?? undefined) : undefined,
        tags: entry.tags,
      };
      const [item] = await repo.createInboxItems([
        {
          agent: "creator",
          type: entry.format,
          channel: entry.channel,
          recipient: entry.channel === "linkedin" ? "Je LinkedIn-feed" : "Je Instagram",
          recipient_key: null,
          title: asset.title,
          reason: `Klaar om te posten · ${formatDayTime(entry.slot_at)} · ${entry.pillar}`,
          value_hint: entry.format === "reel" ? "Film de shots met het teleprompter-script" : null,
          body: asset.body,
          payload,
          status: "pending",
          priority: 5,
          // Kaart verschijnt op de dag zelf in Vandaag.
          visible_from: startOfAmsDay(new Date(entry.slot_at)).toISOString(),
          scheduled_at: entry.slot_at,
          send_after: null,
          snoozed_until: null,
          reject_reason: null,
          sent_at: null,
          result: null,
          calendar_id: entry.id,
          lead_id: null,
        },
      ]);
      itemId = item.id;
      return result;
    });
    return repo.updateCalendarEntry(entry.id, { status: "ready", inbox_item_id: itemId });
  } catch (err) {
    await repo.updateCalendarEntry(entry.id, { status: "failed" });
    throw err;
  }
}

// ── 3. Herschrijf met één instructie ──────────────────────────────────
export async function rewriteItem(repo: Repo, item: InboxItem, instruction: string): Promise<InboxItem> {
  let updated = item;
  await runAgent(repo, item.agent, "manual", async (): Promise<RunResult> => {
    const brain = await repo.getBrain();
    let out: z.infer<typeof RewriteSchema>;
    let result: RunResult;
    if (!aiConfigured()) {
      out = { body: `${item.body}\n\n(demo: herschreven met "${instruction}")`, first_comment: null, slides: item.payload.slides ?? null };
      result = noUsage(0);
    } else {
      const { data, usage } = await callStructured({
        agentPrompt: loadPrompt("rewrite"),
        brain,
        task: [
          `Instructie van Thysja: ${instruction}`,
          `Kanaal: ${item.channel} · type: ${item.type}`,
          `Huidig concept:\n${item.body}`,
          item.payload.first_comment ? `Eerste comment:\n${item.payload.first_comment}` : "",
          item.payload.slides ? `Slides (JSON):\n${JSON.stringify(item.payload.slides)}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        schema: RewriteSchema,
        model: MODEL_WRITE,
        effort: "low",
      });
      out = data;
      result = { usage, itemsCreated: 0 };
    }
    const versions = [...(item.payload.versions ?? []), { body: item.body, at: new Date().toISOString(), instruction }];
    updated = await repo.updateInboxItem(item.id, {
      body: out.body,
      payload: {
        ...item.payload,
        versions,
        first_comment: out.first_comment ?? item.payload.first_comment,
        slides: out.slides ?? item.payload.slides,
      },
    });
    await repo.appendLearning({
      at: new Date().toISOString(),
      agent: item.agent,
      kind: "herschrijving",
      note: `Herschreven op verzoek: "${instruction}"`,
      excerpt: item.title,
    });
    return result;
  });
  return updated;
}

// ── Demo-modus zonder API-sleutel ─────────────────────────────────────
function demoIdeas(bank: string[], pillars: string[]): Omit<ContentIdea, "id" | "created_at" | "run_id">[] {
  const formats: ContentIdea["format"][] = ["post", "carousel", "post", "reel", "carousel", "post", "reel", "post", "carousel", "post"];
  const topics = bank.length ? bank : ["Tijd terugwinnen met AI"];
  return formats.map((format, i) => ({
    hook: `${topics[i % topics.length]} (demo-idee ${i + 1})`,
    angle: "Demo: voeg ANTHROPIC_API_KEY toe voor echte ideeën.",
    format,
    channel: format === "reel" || i % 3 === 2 ? "instagram" : "linkedin",
    pillar: pillars[i % pillars.length] ?? "tijd terugwinnen",
    tags: i === 1 ? ["praktijkcase"] : i === 3 ? ["persoonlijk"] : [],
    status: "new",
    reject_reason: null,
  }));
}

function demoAsset(e: CalendarEntry): z.infer<typeof AssetSchema> {
  return {
    title: e.hook,
    body: `${e.hook}\n\n(Demo-concept. Met een Claude API-sleutel schrijft Creator hier de volledige post.)\n\nHoeveel tijd zou dit jou schelen?`,
    first_comment: "Reageer SCAN voor de gratis AI-scan.",
    hashtags: ["MKB", "AI"],
    slides:
      e.format === "carousel"
        ? [
            { title: e.hook.slice(0, 40), body: "Swipe →" },
            { title: "Stap 1", body: "Kies één taak die elke week terugkomt." },
            { title: "Stap 2", body: "Schrijf op hoe jij hem nu doet." },
            { title: "Stap 3", body: "Laat AI de eerste versie maken. Jij controleert." },
            { title: "Gratis AI-scan", body: "Ontdek waar jij tijd laat liggen." },
          ]
        : null,
    reel:
      e.format === "reel"
        ? {
            hook: e.hook,
            shots: [
              { visual: "Jij aan je bureau, close-up", voiceover: "Dit kostte me elke week drie uur." },
              { visual: "Scherm met de prompt", voiceover: "Nu doe ik het zo." },
              { visual: "Jij met koffie, glimlach", voiceover: "Drie uur terug. Elke week." },
            ],
            subtitles: ["Dit kostte me", "elke week drie uur.", "Nu doe ik het zo.", "Drie uur terug."],
            cta: "Reageer TIJD en ik stuur je de prompt.",
          }
        : null,
  };
}
