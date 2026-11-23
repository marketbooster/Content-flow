// "Maak mijn maandplanning" — deterministische planner (geen AI nodig, dus gratis en uitlegbaar).
// Kijkt naar beschikbare tijd, seizoensmomenten, contentpijlers, al geplande content en
// eerdere swipe-feedback. De AI kan daarna per goedgekeurd idee script + shotlist maken.
import { addDays, daysInMonth, diffDays, ymd } from "./dates";
import { IDEA_TEMPLATES, ideaKey, ideasFor } from "./ideas";
import { occurrencesBetween } from "./occurrences";
import { relevanceFor } from "./relevance";
import type {
  ContentFormat, ContentItem, CreatorProfile, EventOccurrence, IdeaFeedback, IdeaTemplate,
  ISODate, PillarId, SeasonalEvent,
} from "./types";

/** Tijdloze ideeën per pijler, om de maand aan te vullen naast seizoensmomenten. */
export const EVERGREEN_TEMPLATES: IdeaTemplate[] = [
  { id: "evergreen.wat-ik-eet", eventId: "evergreen", pillar: "afvallen", format: "reel", title: "Wat ik eet op een gewone doordeweekse dag", hook: "Geen perfect plaatje, gewoon mijn dag.", description: "What-I-eat-in-a-day met eerlijke porties; voedingswaarden berekenen.", publishDaysBefore: 0, productionMinutes: 90, tags: ["wieiad"], needsNutritionCalc: true },
  { id: "evergreen.mijlpaal", eventId: "evergreen", pillar: "afvallen", format: "carrousel", title: "Mijn afvalreis: wat ik nu anders zou doen", hook: "Als ik opnieuw zou beginnen…", description: "Lessen uit eigen ervaring.", publishDaysBefore: 0, productionMinutes: 60, tags: ["persoonlijk"] },
  { id: "evergreen.15min-recept", eventId: "evergreen", pillar: "recepten", format: "reel", title: "Eiwitrijk avondeten in 15 minuten", hook: "Sneller dan bezorging, en je weet wat erin zit.", description: "Snel gezinsrecept.", publishDaysBefore: 0, productionMinutes: 75, tags: ["snel", "eiwitrijk"], needsNutritionCalc: true },
  { id: "evergreen.swap", eventId: "evergreen", pillar: "recepten", format: "carrousel", title: "3 swaps die ik elke week gebruik", hook: "Kleine wissels, groot verschil.", description: "Swap-carrousel met berekende verschillen.", publishDaysBefore: 0, productionMinutes: 60, tags: ["swaps"], needsNutritionCalc: true },
  { id: "evergreen.thuisworkout", eventId: "evergreen", pillar: "fitness", format: "reel", title: "20-minuten workout als de kinderen slapen", hook: "Geen tijd? Ik ook niet. Dit lukt wél.", description: "Workout zonder materiaal.", publishDaysBefore: 0, productionMinutes: 60, tags: ["thuisworkout"] },
  { id: "evergreen.pcos-dag", eventId: "evergreen", pillar: "pcos", format: "carrousel", title: "Een dag met PCOS: wat je niet ziet", hook: "Van buiten zie je niks. Dit speelt er.", description: "Ervaring delen, geen medisch advies.", publishDaysBefore: 0, productionMinutes: 60, tags: ["pcos"] },
  { id: "evergreen.mama-ochtend", eventId: "evergreen", pillar: "moederschap", format: "reel", title: "Mijn ochtendroutine als moeder (de echte)", hook: "5:45 wakker, en toen…", description: "Herkenbare realiteit.", publishDaysBefore: 0, productionMinutes: 45, tags: ["routine"] },
  { id: "evergreen.herkenbaar", eventId: "evergreen", pillar: "humor", format: "tiktok", title: "Dingen die alleen afvallers snappen", hook: "Ken je dit?", description: "Herkenbare humor-sketch.", publishDaysBefore: 0, productionMinutes: 30, tags: ["sketch"] },
  { id: "evergreen.mindset", eventId: "evergreen", pillar: "ontwikkeling", format: "reel", title: "Waarom ik stopte met mezelf vergelijken", hook: "Het grootste verschil zat niet in de weegschaal.", description: "Talking head.", publishDaysBefore: 0, productionMinutes: 45, tags: ["mindset"] },
  { id: "evergreen.review", eventId: "evergreen", pillar: "samenwerkingen", format: "reel", title: "Eerlijke review: product dat ik zelf kocht", hook: "Niet gesponsord. Wel eerlijk.", description: "Bouwt vertrouwen voor latere samenwerkingen.", publishDaysBefore: 0, productionMinutes: 60, tags: ["review"] },
  { id: "evergreen.stories-week", eventId: "evergreen", pillar: "humor", format: "story", title: "Story-reeks: poll + vragenbox", hook: "Wat wil jij volgende week zien?", description: "Interactie en input voor nieuwe content.", publishDaysBefore: 0, productionMinutes: 15, tags: ["interactie"] },
];

export interface MonthProposal {
  key: string;
  template: IdeaTemplate;
  occurrence?: EventOccurrence;
  eventName?: string;
  date: ISODate;
  reason: string;
  score: number;
}

export interface MonthPlanResult {
  proposals: MonthProposal[];
  capacityMinutes: number;
  alreadyPlannedMinutes: number;
  usedMinutes: number;
  pillarTargets: Partial<Record<PillarId, number>>;
}

export function planMonth(params: {
  year: number;
  month: number;
  creator: CreatorProfile;
  events: SeasonalEvent[];
  content: ContentItem[];
  feedback: IdeaFeedback[];
  today: ISODate;
  maxItems?: number;
}): MonthPlanResult {
  const { year, month, creator, events, content, feedback, today } = params;
  const maxItems = params.maxItems ?? 14;
  const first = ymd(year, month, 1);
  const last = ymd(year, month, daysInMonth(year, month));
  const startFrom = today > first ? today : first;

  // Capaciteit: uren per week × weken in (rest van) de maand, 80% om ruimte te houden.
  const days = Math.max(0, diffDays(startFrom, last) + 1);
  const capacityMinutes = Math.round((creator.hoursPerWeek * 60 * days) / 7 * 0.8);
  const inMonth = content.filter((c) => c.date && c.date >= first && c.date <= last);
  const alreadyPlannedMinutes = inMonth.reduce((s, c) => s + (c.productionMinutes ?? 60), 0);
  let budget = capacityMinutes - alreadyPlannedMinutes;

  // Doelaantallen per pijler op basis van gewicht.
  const activePillars = creator.pillars.filter((p) => p.weight > 0);
  const totalW = activePillars.reduce((s, p) => s + p.weight, 0) || 1;
  const pillarTargets: Partial<Record<PillarId, number>> = {};
  for (const p of activePillars) pillarTargets[p.id] = Math.max(1, Math.round((p.weight / totalW) * maxItems));

  // Kandidaten: seizoensideeën met ideale publicatiedatum in deze maand…
  const byId = new Map(events.map((e) => [e.id, e]));
  const occs = occurrencesBetween(events, addDays(first, -7), addDays(last, 60), today);
  const candidates: MonthProposal[] = [];
  for (const occ of occs) {
    const ev = byId.get(occ.eventId)!;
    const rel = relevanceFor(ev, creator);
    if (rel.score < 40) continue;
    for (const s of ideasFor(occ, creator, feedback, content)) {
      if (s.idealPublishDate < startFrom || s.idealPublishDate > last) continue;
      candidates.push({
        key: s.key, template: s.template, occurrence: occ, eventName: ev.name,
        date: s.idealPublishDate,
        reason: `${ev.name} (${rel.score}% relevant) · ideaal publiceren ${s.template.publishDaysBefore >= 0 ? s.template.publishDaysBefore + " dagen ervoor" : "tijdens het moment"}`,
        score: rel.score * 0.6 + s.score * 0.4 + 15, // seizoensbonus
      });
    }
  }
  // …aangevuld met tijdloze ideeën.
  const monthTag = `${year}-${String(month).padStart(2, "0")}`;
  const decided = new Set(feedback.map((f) => f.ideaKey));
  const pillarWeight = new Map(creator.pillars.map((p) => [p.id, p.weight]));
  for (const t of EVERGREEN_TEMPLATES) {
    const w = pillarWeight.get(t.pillar) ?? 0;
    const key = ideaKey(t.id, monthTag);
    if (w <= 0 || decided.has(key) || content.some((c) => c.ideaTemplateId === t.id && c.date?.startsWith(monthTag))) continue;
    candidates.push({ key, template: t, date: startFrom, reason: "Tijdloos idee voor je contentpijler", score: w * 100 * 0.7 });
  }

  // Gulzige selectie met pijler-quota, formatvariatie en tijdsbudget.
  const chosen: MonthProposal[] = [];
  const pillarCount = new Map<PillarId, number>();
  const formatCount = new Map<ContentFormat, number>();
  for (const c of inMonth) {
    pillarCount.set(c.pillar, (pillarCount.get(c.pillar) ?? 0) + 1);
    formatCount.set(c.format, (formatCount.get(c.format) ?? 0) + 1);
  }
  const pool = [...candidates];
  while (chosen.length < maxItems && pool.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      if (c.template.productionMinutes > budget) return;
      const pc = pillarCount.get(c.template.pillar) ?? 0;
      const target = pillarTargets[c.template.pillar] ?? 0;
      const overQuota = pc >= target ? 40 * (pc - target + 1) : 0;
      const formatPenalty = (formatCount.get(c.template.format) ?? 0) * 6;
      const s = c.score - overQuota - formatPenalty;
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    });
    if (bestIdx < 0) break;
    const [pick] = pool.splice(bestIdx, 1);
    chosen.push(pick);
    budget -= pick.template.productionMinutes;
    pillarCount.set(pick.template.pillar, (pillarCount.get(pick.template.pillar) ?? 0) + 1);
    formatCount.set(pick.template.format, (formatCount.get(pick.template.format) ?? 0) + 1);
    // Niet twee ideeën uit hetzelfde template (seizoensideeën zijn per moment al uniek).
    for (let i = pool.length - 1; i >= 0; i--) if (pool[i].template.id === pick.template.id) pool.splice(i, 1);
  }

  // Tijdloze ideeën verdelen over vrije dagen (seizoensideeën houden hun ideale datum).
  const taken = new Set([...inMonth.map((c) => c.date!), ...chosen.filter((c) => c.occurrence).map((c) => c.date)]);
  const evergreen = chosen.filter((c) => !c.occurrence);
  const freeDays: ISODate[] = [];
  for (let d = startFrom; d <= last; d = addDays(d, 1)) if (!taken.has(d)) freeDays.push(d);
  evergreen.forEach((c, i) => {
    if (freeDays.length === 0) return;
    const idx = Math.min(freeDays.length - 1, Math.floor(((i + 0.5) * freeDays.length) / evergreen.length));
    c.date = freeDays[idx];
  });

  const proposals = chosen.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    proposals,
    capacityMinutes,
    alreadyPlannedMinutes,
    usedMinutes: proposals.reduce((s, p) => s + p.template.productionMinutes, 0),
    pillarTargets,
  };
}

export const ALL_TEMPLATES = [...IDEA_TEMPLATES, ...EVERGREEN_TEMPLATES];
