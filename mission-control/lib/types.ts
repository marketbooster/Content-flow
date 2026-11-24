// Gedeelde domeintypes. Spiegelen de Postgres-enums in supabase/migrations.

export const CHANNELS = ["linkedin", "instagram", "email", "phone", "letter", "blog", "newsletter"] as const;
export type Channel = (typeof CHANNELS)[number];

export const AGENTS = ["scout", "hunter", "ranker", "creator", "listener", "nurturer", "analyst", "chief"] as const;
export type AgentName = (typeof AGENTS)[number];

export type ItemType =
  | "post"
  | "carousel"
  | "reel"
  | "comment"
  | "dm"
  | "connect"
  | "email"
  | "call"
  | "letter"
  | "blog"
  | "newsletter"
  | "pitch";

export type ItemStatus =
  | "pending" // wacht op jou
  | "approved" // goedgekeurd, dispatcher pakt hem op na send_after
  | "scheduled" // goedgekeurd, wacht op verzendvenster of gepland moment
  | "sent"
  | "rejected"
  | "snoozed"
  | "failed";

export const REJECT_REASONS = ["niet relevant", "verkeerde toon", "foute lead", "al benaderd"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type ContentFormat = "post" | "carousel" | "reel";
export const PILLARS = [
  "tijd terugwinnen",
  "praktijkcases",
  "AI-mythbusters",
  "achter de schermen",
  "branche-toepassingen",
] as const;

export interface Slide {
  title: string;
  body: string;
}

export interface ReelScript {
  hook: string;
  shots: { visual: string; voiceover: string }[];
  subtitles: string[];
  cta: string;
}

export interface ItemPayload {
  first_comment?: string;
  slides?: Slide[];
  reel?: ReelScript;
  hashtags?: string[];
  /** Eerdere versies na Herschrijf/Bewerk, nieuwste laatst. */
  versions?: { body: string; at: string; instruction?: string }[];
  /** Persoonlijke post / praktijkcase (voor variatieregels). */
  tags?: string[];
}

export interface InboxItem {
  id: string;
  created_at: string;
  agent: AgentName;
  type: ItemType;
  channel: Channel;
  /** Voor wie: "Je LinkedIn-feed", "Jan de Vries · Bakkerij De Vries" */
  recipient: string;
  /** Unieke sleutel voor dubbel-check en afmeldlijst (e-mail, linkedin-url, telefoon, domein). Leeg bij eigen posts. */
  recipient_key: string | null;
  title: string;
  /** Waarom nu: de reden van de agent. */
  reason: string;
  /** Verwachte waarde, bijv. "warme lead, bezocht je site 2×". */
  value_hint: string | null;
  body: string;
  payload: ItemPayload;
  status: ItemStatus;
  priority: number;
  /** Kaart verschijnt pas vanaf dit moment in Vandaag (bijv. dag van het kalenderslot). */
  visible_from: string | null;
  /** Gewenst verzendmoment (kalenderslot). Leeg = zo snel als het venster toelaat. */
  scheduled_at: string | null;
  /** Ongedaan-maken-venster: dispatcher verstuurt niet vóór dit moment. */
  send_after: string | null;
  snoozed_until: string | null;
  reject_reason: string | null;
  sent_at: string | null;
  result: Record<string, unknown> | null;
  calendar_id: string | null;
  lead_id: string | null;
}

export interface Brain {
  tone: string;
  icp: string;
  pillars: string[];
  prices: string;
  forbidden_words: string[];
  what_worked: string;
  contentbank: string[];
  learnings: Learning[];
  updated_at: string;
}

export interface Learning {
  at: string;
  agent: AgentName;
  kind: "afwijzing" | "herschrijving" | "bijsturing";
  note: string;
  excerpt?: string;
}

export interface Settings {
  paused: boolean;
  monthly_budget_eur: number;
  daily_limits: Partial<Record<Channel, number>>;
  cold_email_enabled: boolean;
  /** Per agent: draait hij op het tijdschema? Standaard uit tot je hem handmatig getest hebt. */
  cron_enabled: Partial<Record<AgentName, boolean>>;
  budget_warned_month: string | null;
}

export interface ContentIdea {
  id: string;
  created_at: string;
  hook: string;
  angle: string;
  format: ContentFormat;
  pillar: string;
  channel: "linkedin" | "instagram";
  tags: string[];
  status: "new" | "accepted" | "rejected" | "today";
  reject_reason: string | null;
  run_id: string | null;
}

export interface CalendarEntry {
  id: string;
  idea_id: string | null;
  channel: "linkedin" | "instagram";
  format: ContentFormat;
  pillar: string;
  hook: string;
  tags: string[];
  slot_at: string;
  status: "planned" | "producing" | "ready" | "posted" | "failed";
  inbox_item_id: string | null;
}

export interface AgentRun {
  id: string;
  agent: AgentName;
  trigger: "manual" | "cron";
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "error";
  input_tokens: number;
  output_tokens: number;
  cost_eur: number;
  items_created: number;
  error: string | null;
}

export interface DispatchLog {
  id: string;
  at: string;
  inbox_item_id: string;
  channel: Channel;
  recipient_key: string | null;
  adapter: string;
  outcome: "sent" | "manual" | "failed" | "blocked" | "deferred";
  detail: string;
  body: string;
  external_id: string | null;
  external_url: string | null;
}

export interface Suppression {
  id: string;
  value: string;
  reason: string;
  created_at: string;
}

export const DEFAULT_SETTINGS: Settings = {
  paused: false,
  monthly_budget_eur: 100,
  daily_limits: { email: 20, linkedin: 15, instagram: 5, phone: 15, letter: 5, blog: 1, newsletter: 1 },
  cold_email_enabled: false,
  cron_enabled: {},
  budget_warned_month: null,
};

export const EMPTY_BRAIN: Brain = {
  tone: "",
  icp: "",
  pillars: [...PILLARS],
  prices: "",
  forbidden_words: [],
  what_worked: "",
  contentbank: [],
  learnings: [],
  updated_at: new Date(0).toISOString(),
};
