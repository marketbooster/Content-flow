// Kern-datatypes van ContentFlow. Pure TypeScript, gedeeld door frontend en server.

/** ISO-datum zonder tijd, bv. "2026-12-05". Altijd geïnterpreteerd in Europe/Amsterdam. */
export type ISODate = string;

export type PillarId =
  | "afvallen"
  | "recepten"
  | "fitness"
  | "pcos"
  | "moederschap"
  | "humor"
  | "ontwikkeling"
  | "samenwerkingen";

export type EventType =
  | "feestdag_nl"
  | "feestdag_int"
  | "seizoen"
  | "schoolvakantie"
  | "commercieel"
  | "awareness"
  | "sport"
  | "cultureel"
  | "niche"
  | "persoonlijk"
  | "trend";

/**
 * Hoe de datum tot stand komt. Dit is het onderscheid dat de UI toont:
 * - fixed:     vaste kalenderdatum (5 december)
 * - computed:  jaarlijks berekend met een deterministische regel (Pasen, Moederdag)
 * - verified:  door een mens gecontroleerde datum voor één specifiek jaar (schoolvakanties)
 * - trend:     actueel moment; alleen geldig met bron + vaststellingsdatum, verloopt
 */
export type DateKind = "fixed" | "computed" | "verified" | "trend";

export type Reliability = "betrouwbaar" | "berekend" | "te_verifieren" | "verlopen";

export type RecurrenceRule =
  | { kind: "fixed"; month: number; day: number; durationDays?: number }
  | { kind: "nthWeekday"; month: number; weekday: number; n: number; offsetDays?: number; durationDays?: number }
  | { kind: "lastWeekday"; month: number; weekday: number; offsetDays?: number; durationDays?: number }
  | { kind: "easter"; offsetDays: number; durationDays?: number }
  | { kind: "koningsdag" }
  | { kind: "month"; month: number }
  | { kind: "explicit"; occurrences: ExplicitOccurrence[] };

export interface ExplicitOccurrence {
  start: ISODate;
  end: ISODate;
  region?: Region;
  verifiedAt?: ISODate;
  sourceUrl?: string;
}

export type Region = "NL" | "NL-noord" | "NL-midden" | "NL-zuid" | "INT";

export type ContentFormat = "reel" | "tiktok" | "carrousel" | "story" | "post" | "live" | "blog";

export interface PrepStage {
  id: "samenwerking" | "concept" | "productie" | "publicatie" | "dag_zelf";
  label: string;
  daysBefore: number;
}

export interface SeasonalEvent {
  id: string;
  name: string;
  type: EventType;
  dateKind: DateKind;
  rule: RecurrenceRule;
  region: Region;
  /** Contentcategorieën / pijlers waarvoor dit moment relevant kan zijn, met gewicht 0..1. */
  pillarFit: Partial<Record<PillarId, number>>;
  audiences: string[];
  contentCategories: string[];
  source: { label: string; url?: string };
  lastVerified?: ISODate;
  /** Hoe groot het moment is (1 = klein inhakertje, 3 = groot commercieel moment). */
  weight: 1 | 2 | 3;
  /** Afwijkende voorbereidingstermijnen; anders gelden de creator-defaults. */
  prepOverride?: Partial<Record<PrepStage["id"], number>>;
  /** Voor trends: na deze datum vervalt het item. */
  expiresAt?: ISODate;
  description?: string;
}

export interface EventOccurrence {
  key: string; // `${eventId}:${start}` — uniek, voorkomt dubbelingen
  eventId: string;
  start: ISODate;
  end: ISODate;
  region: Region;
  reliability: Reliability;
}

export interface CreatorProfile {
  id: string;
  name: string;
  handle: string;
  pillars: { id: PillarId; label: string; weight: number }[];
  /** Beschikbare productie-uren per week. */
  hoursPerWeek: number;
  brandVoice: string;
  audience: string;
  region: Region;
  prepDefaults: PrepStage[];
  notifications: NotificationPrefs;
  mutedEventIds: string[];
  /** Ideeën en onderwerpen die de creator expliciet niet wil. */
  blockedTopics: string[];
}

export interface NotificationPrefs {
  enabled: boolean;
  maxPerWeek: number;
  minRelevance: number; // 0..100
  stages: PrepStage["id"][];
}

export interface IdeaTemplate {
  id: string;
  eventId: string;
  pillar: PillarId;
  format: ContentFormat;
  title: string;
  hook: string;
  description: string;
  /** Ideale publicatie in dagen vóór de start van het moment (0 = op de dag zelf). */
  publishDaysBefore: number;
  productionMinutes: number;
  tags: string[];
  /** Recepten: voedingswaarden moeten per recept berekend worden, nooit geschat getoond. */
  needsNutritionCalc?: boolean;
  /** Commerciële ideeën vragen om bevestiging van briefing/exclusiviteit. */
  commercial?: boolean;
}

/** Productiestatus (kolommen van het productiebord). De publicatiedatum staat los hiervan. */
export type ContentStatus = "idee" | "script" | "gefilmd" | "bewerkt" | "gepubliceerd";

export const CONTENT_STATUSES: { id: ContentStatus; label: string }[] = [
  { id: "idee", label: "Idee" },
  { id: "script", label: "Script" },
  { id: "gefilmd", label: "Gefilmd" },
  { id: "bewerkt", label: "Bewerkt" },
  { id: "gepubliceerd", label: "Gepost" },
];

/** Waar iets gefilmd wordt; bepaalt de bundeling op een opnamedag. */
export type ShootLocation = "keuken" | "sportschool" | "thuis" | "buiten" | "onderweg";

export const SHOOT_LOCATIONS: { id: ShootLocation; label: string; emoji: string }[] = [
  { id: "keuken", label: "Keuken", emoji: "🍳" },
  { id: "thuis", label: "Thuis / woonkamer", emoji: "🛋️" },
  { id: "sportschool", label: "Sportschool", emoji: "🏋️" },
  { id: "buiten", label: "Buiten", emoji: "🌳" },
  { id: "onderweg", label: "Onderweg / winkel", emoji: "🛒" },
];

export interface ShootDay {
  id: string;
  date: ISODate;
  minutesAvailable: number;
  contentIds: string[];
  createdAt: string;
}

export type DealPlatform = "influentials" | "join" | "direct" | "anders";
export type DealStatus =
  | "aanbod" | "onderhandeling" | "akkoord" | "content_ingediend" | "live" | "gefactureerd" | "betaald" | "afgewezen";

export const DEAL_STATUSES: { id: DealStatus; label: string }[] = [
  { id: "aanbod", label: "Aanbod" },
  { id: "onderhandeling", label: "Onderhandeling" },
  { id: "akkoord", label: "Akkoord" },
  { id: "content_ingediend", label: "Content ingediend" },
  { id: "live", label: "Live" },
  { id: "gefactureerd", label: "Gefactureerd" },
  { id: "betaald", label: "Betaald" },
  { id: "afgewezen", label: "Afgewezen" },
];

export interface Deal {
  id: string;
  brand: string;
  platform: DealPlatform;
  status: DealStatus;
  feeEUR?: number;
  deliverables: string;
  /** Uiterste datum om content aan te leveren. */
  contentDeadline?: ISODate;
  /** Datum waarop de content live moet. */
  liveDate?: ISODate;
  /** Exclusiviteit: geen concurrerende merken in deze categorie tot en met `until`. */
  exclusivity?: { category: string; until: ISODate };
  category: string; // productcategorie, bv. "sportvoeding", "kleding"
  notes: string;
  link?: string;
  createdAt: string;
}

/** Eén contentitem — de enige planningsbron. Seizoensideeën worden hieraan gekoppeld. */
export interface ContentItem {
  id: string;
  title: string;
  hook?: string;
  description?: string;
  pillar: PillarId;
  format: ContentFormat;
  status: ContentStatus;
  date?: ISODate;
  /** Koppeling naar seizoensmoment + bronidee (voorkomt dubbele ideeën). */
  eventKey?: string;
  ideaTemplateId?: string;
  productionMinutes?: number;
  script?: string;
  shotlist?: string[];
  needsNutritionCalc?: boolean;
  location?: ShootLocation;
  dealId?: string;
  hooks?: string[];
  hashtags?: string[];
  createdAt: string;
  source: "handmatig" | "seasonal" | "maandplanning" | "ai" | "deal";
}

export type SwipeDecision = "bewaard" | "afgewezen";

export interface IdeaFeedback {
  ideaKey: string; // `${templateId}@${eventKey}`
  decision: SwipeDecision;
  at: string;
}
