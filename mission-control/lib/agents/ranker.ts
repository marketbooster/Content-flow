import "server-only";
import { z } from "zod";
import type { Repo } from "../db/repo";
import type { BlogBrief, InboxItem } from "../types";
import { addUsage, aiConfigured, callStructured, loadPrompt, MODEL_WRITE, research } from "../ai";
import { noUsage, runAgent, type RunResult } from "./runner";
import { listSitePosts, SITE_PAGES, type SitePost } from "../site";
import { seoChecks, seoScore, slugify } from "../seo";
import { amsDayAt, amsParts, formatDay, startOfAmsDay } from "../time";

// Ranker: elke week één stap sterker in Google én in AI-antwoorden.
// ma: blogbrief (onderzoek + voorstel) · na goedkeuring: volledige blog · vr: één linkkans.

const BriefSchema = z.object({
  keyword: z.string(),
  intent: z.string(),
  title: z.string(),
  angle: z.string(),
  outline: z.array(z.string()),
  questions: z.array(z.string()),
  internal_links: z.array(z.object({ anchor: z.string(), url: z.string() })),
  serp_notes: z.string(),
  cannibalization: z.string(),
});

const BlogSchema = z.object({
  slug: z.string(),
  seo_title: z.string(),
  seo_description: z.string(),
  excerpt: z.string(),
  tags: z.array(z.string()),
  primary_keyword: z.string(),
  markdown: z.string(),
  repurpose: z.object({ linkedin_hook: z.string(), carousel_hook: z.string(), newsletter_paragraph: z.string() }),
});

const PitchSchema = z.object({
  site_name: z.string(),
  site_url: z.string(),
  opportunity: z.string(),
  email: z.string(),
  contact_url: z.string(),
  subject: z.string(),
  body: z.string(),
  why: z.string(),
});

function linkTargets(posts: SitePost[]): string {
  return [
    ...SITE_PAGES.map((p) => `- ${p.url} — ${p.about}`),
    ...posts.map((p) => `- /blog/${p.slug} — blog: ${p.title}`),
  ].join("\n");
}

function base(): Omit<InboxItem, "id" | "created_at" | "type" | "channel" | "recipient" | "title" | "reason" | "body" | "payload"> {
  return {
    agent: "ranker",
    recipient_key: null,
    value_hint: null,
    status: "pending",
    priority: 4,
    visible_from: null,
    scheduled_at: null,
    send_after: null,
    snoozed_until: null,
    reject_reason: null,
    sent_at: null,
    result: null,
    calendar_id: null,
    lead_id: null,
  };
}

// ── 1. Maandag: blogbrief ─────────────────────────────────────────────
export async function runRankerBrief(repo: Repo, trigger: "manual" | "cron") {
  return runAgent(repo, "ranker", trigger, async (): Promise<RunResult> => {
    const [brain, keywords, posts, pending] = await Promise.all([
      repo.getBrain(),
      repo.listKeywords(),
      listSitePosts().catch(() => [] as SitePost[]),
      repo.listInbox({ statuses: ["pending", "approved", "scheduled", "snoozed"] }),
    ]);
    // Eén open brief tegelijk: liever één blog af dan drie halve.
    if (pending.some((i) => i.agent === "ranker" && (i.type === "brief" || i.type === "blog"))) return noUsage(0);

    let brief: BlogBrief;
    let result: RunResult;
    if (!aiConfigured()) {
      brief = demoBrief(brain.contentbank[0] ?? "offerte maken met AI");
      result = noUsage(1);
    } else {
      const nearPageOne = keywords.filter((k) => k.position !== null && k.position >= 8 && k.position <= 20);
      const candidates = [
        ...nearPageOne.map((k) => `- "${k.keyword}" (positie ${k.position}, ${k.impressions ?? "?"} vertoningen) → bijna pagina 1`),
        ...keywords.filter((k) => k.position === null).map((k) => `- "${k.keyword}" (doelzoekwoord van Thysja)`),
        ...brain.contentbank.map((c) => `- ${c} (contentbank)`),
      ].join("\n");
      const task = [
        `Kandidaat-onderwerpen:\n${candidates || "(geen; bedenk zelf een kansrijk onderwerp binnen de pijlers)"}`,
        `Bestaande blogs op marketbooster.nl (niet herhalen):\n${posts.map((p) => `- ${p.title} (/blog/${p.slug})`).join("\n") || "(onbekend: koppeling met de website ontbreekt)"}`,
        `Pagina's om naar te linken:\n${linkTargets(posts)}`,
      ].join("\n\n");
      const r = await research({ agentPrompt: loadPrompt("ranker-research"), brain, task });
      const { data, usage } = await callStructured({
        agentPrompt: loadPrompt("ranker-brief"),
        brain,
        task: `${task}\n\nOnderzoeksnotities:\n${r.notes}`,
        schema: BriefSchema,
        effort: "medium",
      });
      brief = data;
      result = { usage: addUsage(r.usage, usage), itemsCreated: 1 };
    }

    await repo.createInboxItems([
      {
        ...base(),
        type: "brief",
        channel: "blog",
        recipient: "marketbooster.nl/blog",
        title: brief.title,
        reason: `Blogbrief van de week · zoekwoord "${brief.keyword}"`,
        value_hint: brief.angle,
        body: [
          `Zoekintentie: ${brief.intent}`,
          "",
          "Opbouw:",
          ...brief.outline.map((h, i) => `${i + 1}. ${h}`),
          "",
          `Wat er nu rankt: ${brief.serp_notes}`,
          `Overlap met bestaande blogs: ${brief.cannibalization}`,
        ].join("\n"),
        payload: { brief },
      },
    ]);
    return result;
  });
}

// ── 2. Na goedkeuring: de volledige blog ─────────────────────────────
export async function writeBlog(repo: Repo, briefItem: InboxItem, trigger: "manual" | "cron" = "manual"): Promise<InboxItem> {
  const brief = briefItem.payload.brief;
  if (!brief) throw new Error("Dit item is geen blogbrief");
  let created: InboxItem | null = null;
  await runAgent(repo, "ranker", trigger, async (): Promise<RunResult> => {
    const brain = await repo.getBrain();
    let blog: z.infer<typeof BlogSchema>;
    let result: RunResult;
    if (!aiConfigured()) {
      blog = demoBlog(brief);
      result = noUsage(1);
    } else {
      const { data, usage } = await callStructured({
        agentPrompt: loadPrompt("ranker-blog"),
        brain,
        task: `Goedgekeurde brief (JSON):\n${JSON.stringify(brief, null, 2)}`,
        schema: BlogSchema,
        model: MODEL_WRITE,
        effort: "high",
        maxTokens: 64000,
      });
      blog = { ...data, slug: slugify(data.slug || brief.keyword) };
      result = { usage, itemsCreated: 1 };
    }

    const draft = {
      slug: blog.slug,
      seo_title: blog.seo_title,
      seo_description: blog.seo_description,
      excerpt: blog.excerpt,
      tags: blog.tags,
      primary_keyword: blog.primary_keyword,
      markdown: blog.markdown,
    };
    const score = seoScore(seoChecks(draft, brain.forbidden_words));
    // Woensdag is publicatiedag; is het al woensdag of later, dan zo snel mogelijk.
    const now = new Date();
    const wd = amsParts(now).weekday;
    const wednesday = wd >= 1 && wd < 3 ? amsDayAt(now, 3 - wd, 9, 0) : null;

    [created] = await repo.createInboxItems([
      {
        ...base(),
        type: "blog",
        channel: "blog",
        recipient: "marketbooster.nl/blog",
        title: brief.title,
        reason: `Blog klaar · "${brief.keyword}"${wednesday ? ` · gepland ${formatDay(wednesday)} 09:00` : ""}`,
        value_hint: `SEO-check ${score}/100`,
        body: blog.excerpt,
        payload: { blog: draft, brief, repurpose: blog.repurpose },
        priority: 5,
        visible_from: wednesday ? startOfAmsDay(wednesday).toISOString() : null,
        scheduled_at: wednesday ? wednesday.toISOString() : null,
      },
    ]);
    return result;
  });
  return created!;
}

// ── 3. Vrijdag: één linkkans ──────────────────────────────────────────
export async function runRankerLinkPitch(repo: Repo, trigger: "manual" | "cron") {
  return runAgent(repo, "ranker", trigger, async (): Promise<RunResult> => {
    const [brain, posts, log] = await Promise.all([repo.getBrain(), listSitePosts().catch(() => []), repo.listDispatchLog(100)]);
    const contacted = [...new Set(log.filter((l) => l.channel === "email").map((l) => l.recipient_key).filter(Boolean))];

    let pitch: z.infer<typeof PitchSchema>;
    let result: RunResult;
    if (!aiConfigured()) {
      pitch = {
        site_name: "Voorbeeldmedium (demo)",
        site_url: "https://example.nl",
        opportunity: "Gastblog (demo)",
        email: "redactie@example.nl",
        contact_url: "",
        subject: "Gastartikel: offertes in 10 minuten met AI",
        body: "Demo-pitch. Met een Claude API-sleutel zoekt Ranker een echte linkkans en schrijft hij de pitch.",
        why: "Demo",
      };
      result = noUsage(1);
    } else {
      const task = [
        `Beste blogs van Thysja om naar te verwijzen:\n${posts.slice(0, 8).map((p) => `- ${p.title}: https://marketbooster.nl/blog/${p.slug}`).join("\n") || "(onbekend)"}`,
        `Al eerder benaderd (overslaan): ${contacted.join(", ") || "niemand"}`,
      ].join("\n\n");
      const r = await research({ agentPrompt: loadPrompt("ranker-linkpitch"), brain, task });
      const { data, usage } = await callStructured({
        agentPrompt: loadPrompt("ranker-linkpitch"),
        brain,
        task: `${task}\n\nOnderzoeksnotities:\n${r.notes}\n\nLever nu de ene beste kans met de pitch.`,
        schema: PitchSchema,
        effort: "medium",
      });
      pitch = data;
      result = { usage: addUsage(r.usage, usage), itemsCreated: 1 };
    }

    const to = pitch.email.trim();
    await repo.createInboxItems([
      {
        ...base(),
        type: "pitch",
        channel: "email",
        recipient: `${pitch.site_name}${to ? ` · ${to}` : ""}`,
        recipient_key: to || new URL(pitch.site_url).hostname,
        title: pitch.subject,
        reason: `Linkkans van de week · ${pitch.opportunity}`,
        value_hint: pitch.why,
        body: pitch.body,
        payload: { email: { to: to || pitch.contact_url, subject: pitch.subject } },
        priority: 3,
      },
    ]);
    return result;
  });
}

// ── Demo zonder API-sleutel ───────────────────────────────────────────
function demoBrief(topic: string): BlogBrief {
  const kw = topic.toLowerCase();
  return {
    keyword: kw,
    intent: "Informatief: ondernemer wil weten hoe het werkt en wat het oplevert.",
    title: `${topic}: stappenplan voor het MKB`,
    angle: "Demo-brief. Met een Claude API-sleutel onderzoekt Ranker eerst Google.",
    outline: ["Wat levert het op?", "Stap 1: kies één taak", "Stap 2: schrijf je prompt", "Valkuilen", "Veelgestelde vragen"],
    questions: ["Is dit veilig voor klantgegevens?", "Wat kost het?", "Hoe lang duurt het om op te zetten?"],
    internal_links: [
      { anchor: "gratis AI-scan", url: "/gratis-ai-scan" },
      { anchor: "AI-automatisering", url: "/diensten/ai-automatisering" },
    ],
    serp_notes: "Demo.",
    cannibalization: "Demo: niet gecontroleerd.",
  };
}

function demoBlog(b: BlogBrief): z.infer<typeof BlogSchema> {
  const para = "Demo-tekst. Met een Claude API-sleutel schrijft Ranker hier een volledig artikel van 1100–1800 woorden.";
  return {
    slug: slugify(b.keyword),
    seo_title: b.title.slice(0, 60),
    seo_description: `${b.keyword}: zo pak je het als MKB'er aan, met stappenplan en valkuilen. Demo-omschrijving voor de preview.`.slice(0, 160),
    excerpt: `Zo pak je ${b.keyword} aan, stap voor stap.`,
    tags: ["AI voor MKB"],
    primary_keyword: b.keyword,
    markdown: [
      `${b.keyword} levert je als MKB'er al snel uren per week op. ${para}`,
      ...b.outline.slice(0, -1).flatMap((h) => [`## ${h}`, para]),
      `Benieuwd waar jij tijd laat liggen? Doe de [gratis AI-scan](/gratis-ai-scan) of lees over [AI-automatisering](/diensten/ai-automatisering).`,
      "## Veelgestelde vragen",
      ...b.questions.flatMap((q) => [`### ${q}`, "Demo-antwoord."]),
    ].join("\n\n"),
    repurpose: { linkedin_hook: b.title, carousel_hook: b.title, newsletter_paragraph: para },
  };
}
