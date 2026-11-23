// Contentmix-analyse. Geeft alleen signalen en suggesties; wijzigt nooit zelf de planning.
import { addDays, diffDays } from "./dates";
import { relevanceFor } from "./relevance";
import type {
  ContentItem, CreatorProfile, EventOccurrence, ISODate, SeasonalEvent,
} from "./types";

export type MixSignalKind =
  | "format_eenzijdig"
  | "kans_onbenut"
  | "onderwerp_herhaalt"
  | "te_laat"
  | "past_niet";

export interface MixSignal {
  id: string;
  kind: MixSignalKind;
  severity: "info" | "let_op";
  title: string;
  detail: string;
  suggestion: string;
  relatedContentIds: string[];
  relatedOccurrenceKey?: string;
}

const FORMAT_LABEL: Record<string, string> = {
  reel: "reels", tiktok: "TikToks", carrousel: "carrousels", story: "stories",
  post: "posts", live: "lives", blog: "blogs",
};

export function analyzeMix(
  content: ContentItem[],
  creator: CreatorProfile,
  events: SeasonalEvent[],
  upcoming: EventOccurrence[],
  today: ISODate,
  windowDays = 28,
): MixSignal[] {
  const signals: MixSignal[] = [];
  const end = addDays(today, windowDays);
  const planned = content.filter(
    (c) => c.date && c.date >= today && c.date <= end && c.status !== "gepubliceerd",
  );
  const byEvent = new Map(events.map((e) => [e.id, e]));
  const pillarLabel = new Map(creator.pillars.map((p) => [p.id, p.label]));

  // 1. Te veel van hetzelfde format
  if (planned.length >= 4) {
    const counts = countBy(planned, (c) => c.format);
    for (const [format, n] of counts) {
      if (n / planned.length > 0.6) {
        signals.push({
          id: `format:${format}`,
          kind: "format_eenzijdig",
          severity: "info",
          title: `Veel ${FORMAT_LABEL[format] ?? format}`,
          detail: `${n} van de ${planned.length} geplande items in de komende ${Math.round(windowDays / 7)} weken zijn ${FORMAT_LABEL[format] ?? format}.`,
          suggestion: "Overweeg een carrousel of story-reeks om je mix te variëren.",
          relatedContentIds: planned.filter((c) => c.format === format).map((c) => c.id),
        });
      }
    }
  }

  // 2. Onderwerp komt te vaak terug
  if (planned.length >= 4) {
    const counts = countBy(planned, (c) => c.pillar);
    for (const [pillar, n] of counts) {
      if (n / planned.length > 0.5) {
        signals.push({
          id: `pijler:${pillar}`,
          kind: "onderwerp_herhaalt",
          severity: "info",
          title: `${pillarLabel.get(pillar) ?? pillar} domineert`,
          detail: `${n} van de ${planned.length} geplande items gaan over ${pillarLabel.get(pillar) ?? pillar}.`,
          suggestion: "Wissel af met een andere pijler, bijvoorbeeld humor of persoonlijke ontwikkeling.",
          relatedContentIds: planned.filter((c) => c.pillar === pillar).map((c) => c.id),
        });
      }
    }
  }

  // 3. Onbenutte seizoenskansen (relevant, binnen 6 weken, nog niets aan gekoppeld)
  const linked = new Set(content.map((c) => c.eventKey).filter(Boolean));
  for (const occ of upcoming) {
    const ev = byEvent.get(occ.eventId);
    if (!ev) continue;
    const until = diffDays(today, occ.start);
    // Alleen grote momenten ruim vooraf; kleinere pas als de productiefase nadert (minder ruis).
    if (until < 0 || until > 42 || (ev.weight < 3 && until > 21)) continue;
    const rel = relevanceFor(ev, creator);
    if (rel.score < 60 || linked.has(occ.key)) continue;
    signals.push({
      id: `kans:${occ.key}`,
      kind: "kans_onbenut",
      severity: ev.weight === 3 ? "let_op" : "info",
      title: `${ev.name} nog niet benut`,
      detail: `${ev.name} is over ${until} dagen en past bij je pijlers (${rel.score}% relevant), maar er staat nog niets voor gepland.`,
      suggestion: "Open de Seasonal Swipe voor dit moment en kies 1–2 ideeën.",
      relatedContentIds: [],
      relatedOccurrenceKey: occ.key,
    });
  }

  // 4. Te laat ingepland / gepland na het moment
  for (const c of content) {
    if (!c.eventKey || !c.date || c.status === "gepubliceerd") continue;
    const occ = upcoming.find((o) => o.key === c.eventKey);
    if (!occ) continue;
    const ev = byEvent.get(occ.eventId);
    if (c.date > occ.end) {
      signals.push({
        id: `na:${c.id}`,
        kind: "te_laat",
        severity: "let_op",
        title: `“${c.title}” staat ná ${ev?.name ?? "het moment"}`,
        detail: `Gepland op ${c.date}, terwijl het moment eindigt op ${occ.end}.`,
        suggestion: "Verplaats het naar vóór het moment, of maak er een terugblik-item van.",
        relatedContentIds: [c.id],
        relatedOccurrenceKey: occ.key,
      });
      continue;
    }
    const daysLeft = diffDays(today, c.date);
    const needDays = Math.ceil((c.productionMinutes ?? 60) / 60); // ≥ 1 productiedag per uur werk
    if ((c.status === "idee" || c.status === "gepland") && daysLeft >= 0 && daysLeft < needDays + 2) {
      signals.push({
        id: `krap:${c.id}`,
        kind: "te_laat",
        severity: "let_op",
        title: `Krap: “${c.title}”`,
        detail: `Nog ${daysLeft} dag(en) tot publicatie en de productie is nog niet gestart.`,
        suggestion: "Plan een opnamemoment of kies een lichtere variant (bijv. story i.p.v. reel).",
        relatedContentIds: [c.id],
        relatedOccurrenceKey: occ.key,
      });
    }
  }

  // 5. Past niet bij de creator
  const activePillars = new Set(creator.pillars.filter((p) => p.weight > 0).map((p) => p.id));
  const blocked = creator.blockedTopics.map((b) => b.toLowerCase()).filter(Boolean);
  for (const c of planned) {
    const hay = `${c.title} ${c.description ?? ""}`.toLowerCase();
    const hit = blocked.find((b) => hay.includes(b));
    if (!activePillars.has(c.pillar) || hit) {
      signals.push({
        id: `fit:${c.id}`,
        kind: "past_niet",
        severity: "info",
        title: `“${c.title}” past mogelijk niet`,
        detail: hit
          ? `Bevat “${hit}”, een onderwerp dat je hebt uitgesloten.`
          : "Deze contentpijler staat bij jou uit.",
        suggestion: "Bekijk of je dit item wilt houden; ContentFlow past niets aan zonder jouw akkoord.",
        relatedContentIds: [c.id],
      });
    }
  }

  return signals;
}

function countBy<T, K>(items: T[], f: (t: T) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const i of items) m.set(f(i), (m.get(f(i)) ?? 0) + 1);
  return m;
}
