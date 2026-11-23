// Relevantie per creator en vooruitplannende meldingen.
import { addDays, diffDays } from "./dates";
import type {
  CreatorProfile, EventOccurrence, ISODate, PillarId, PrepStage, SeasonalEvent,
} from "./types";

export interface RelevanceResult {
  score: number; // 0..100
  topPillars: PillarId[];
  reason: string;
}

const WEIGHT_FACTOR: Record<1 | 2 | 3, number> = { 1: 0.7, 2: 0.85, 3: 1 };

export function relevanceFor(ev: SeasonalEvent, creator: CreatorProfile): RelevanceResult {
  if (creator.mutedEventIds.includes(ev.id)) {
    return { score: 0, topPillars: [], reason: "Je hebt dit moment uitgezet." };
  }
  const contributions = creator.pillars
    .map((p) => ({ id: p.id, label: p.label, v: (ev.pillarFit[p.id] ?? 0) * p.weight }))
    .filter((c) => c.v > 0)
    .sort((a, b) => b.v - a.v);
  if (contributions.length === 0) {
    return { score: 0, topPillars: [], reason: "Past niet bij je contentpijlers." };
  }
  const max = contributions[0].v;
  const top3 = contributions.slice(0, 3);
  const mean = top3.reduce((s, c) => s + c.v, 0) / 3;
  let score = (0.7 * max + 0.3 * mean) * WEIGHT_FACTOR[ev.weight];
  const regionPenalty =
    ev.region.startsWith("NL-") && creator.region !== ev.region ? 0.6 : 1;
  score *= regionPenalty;
  const pct = Math.round(Math.min(1, score) * 100);
  const labels = top3.map((c) => c.label.toLowerCase());
  const reason =
    `Sluit aan op ${labels.join(", ")}` +
    (regionPenalty < 1 ? " (regionaal moment buiten jouw regio)" : "");
  return { score: pct, topPillars: top3.map((c) => c.id), reason };
}

export const DEFAULT_PREP_STAGES: PrepStage[] = [
  { id: "samenwerking", label: "Samenwerkingen & grotere campagnes", daysBefore: 56 },
  { id: "concept", label: "Ideeën & conceptontwikkeling", daysBefore: 42 },
  { id: "productie", label: "Productie", daysBefore: 21 },
  { id: "publicatie", label: "Publicatievoorstellen", daysBefore: 7 },
  { id: "dag_zelf", label: "Snelle stories & last-minute", daysBefore: 0 },
];

export function stagesFor(ev: SeasonalEvent, creator: CreatorProfile): PrepStage[] {
  return creator.prepDefaults.map((s) => ({
    ...s,
    daysBefore: ev.prepOverride?.[s.id] ?? s.daysBefore,
  }));
}

/** In welke voorbereidingsfase zit dit moment vandaag? */
export function currentStage(
  ev: SeasonalEvent, occ: EventOccurrence, creator: CreatorProfile, today: ISODate,
): { stage: PrepStage; daysUntil: number } | null {
  const daysUntil = diffDays(today, occ.start);
  if (diffDays(today, occ.end) < 0) return null;
  const stages = stagesFor(ev, creator).sort((a, b) => b.daysBefore - a.daysBefore);
  let current: PrepStage | null = null;
  for (const s of stages) if (daysUntil <= s.daysBefore) current = s;
  return current ? { stage: current, daysUntil } : null;
}

export interface PrepAlert {
  key: string; // `${occurrenceKey}:${stageId}` — eenmalig per fase
  occurrence: EventOccurrence;
  event: SeasonalEvent;
  stage: PrepStage;
  stageDate: ISODate;
  relevance: number;
  message: string;
}

/**
 * Meldingen voor fases die vandaag (of in de afgelopen `graceDays`) zijn ingegaan.
 * Begrensd tot `maxPerWeek`, gesorteerd op relevantie × gewicht. Eerder getoonde of
 * weggeklikte meldingen komen niet terug.
 */
export function prepAlerts(
  events: SeasonalEvent[],
  occurrences: EventOccurrence[],
  creator: CreatorProfile,
  today: ISODate,
  seenAlertKeys: Set<string>,
  graceDays = 6,
): PrepAlert[] {
  const prefs = creator.notifications;
  if (!prefs.enabled) return [];
  const byId = new Map(events.map((e) => [e.id, e]));
  const candidates: PrepAlert[] = [];
  for (const occ of occurrences) {
    const ev = byId.get(occ.eventId);
    if (!ev) continue;
    const rel = relevanceFor(ev, creator);
    if (rel.score < prefs.minRelevance) continue;
    for (const stage of stagesFor(ev, creator)) {
      if (!prefs.stages.includes(stage.id)) continue;
      const stageDate = addDays(occ.start, -stage.daysBefore);
      const age = diffDays(stageDate, today);
      if (age < 0 || age > graceDays) continue;
      const key = `${occ.key}:${stage.id}`;
      if (seenAlertKeys.has(key)) continue;
      candidates.push({
        key, occurrence: occ, event: ev, stage, stageDate, relevance: rel.score,
        message: alertMessage(ev, stage, diffDays(today, occ.start)),
      });
    }
  }
  // Per moment alleen de meest recente fase tonen (voorkomt 2 meldingen voor hetzelfde moment).
  const perOcc = new Map<string, PrepAlert>();
  for (const a of candidates) {
    const prev = perOcc.get(a.occurrence.key);
    if (!prev || a.stage.daysBefore < prev.stage.daysBefore) perOcc.set(a.occurrence.key, a);
  }
  return [...perOcc.values()]
    .sort((a, b) => b.relevance * b.event.weight - a.relevance * a.event.weight)
    .slice(0, prefs.maxPerWeek);
}

function alertMessage(ev: SeasonalEvent, stage: PrepStage, daysUntil: number): string {
  const when = daysUntil <= 0 ? "vandaag" : daysUntil < 14 ? `over ${daysUntil} dagen` : `over ${Math.round(daysUntil / 7)} weken`;
  switch (stage.id) {
    case "samenwerking":
      return `${ev.name} is ${when}. Goed moment om merken te benaderen of een campagne op te zetten.`;
    case "concept":
      return `${ev.name} is ${when}. Tijd om ideeën te kiezen en concepten uit te werken.`;
    case "productie":
      return `${ev.name} is ${when}. Plan je opnames, zodat je niet in tijdnood komt.`;
    case "publicatie":
      return `${ev.name} is ${when}. Zet je content klaar voor publicatie.`;
    case "dag_zelf":
      return `Het is ${ev.name}! Tijd voor een snelle story of last-minute inhaker.`;
  }
}
