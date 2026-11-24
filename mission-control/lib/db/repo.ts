import type {
  AgentName,
  AgentRun,
  Brain,
  CalendarEntry,
  Channel,
  ContentIdea,
  DispatchLog,
  InboxItem,
  Learning,
  Settings,
  Suppression,
} from "../types";

export type NewInboxItem = Omit<InboxItem, "id" | "created_at"> & Partial<Pick<InboxItem, "id">>;
export type NewIdea = Omit<ContentIdea, "id" | "created_at">;
export type NewCalendarEntry = Omit<CalendarEntry, "id">;

/** Eén toegangslaag voor de hele app. Supabase in productie, een lokaal JSON-bestand in demo-modus. */
export interface Repo {
  readonly mode: "supabase" | "demo";

  getBrain(): Promise<Brain>;
  saveBrain(brain: Omit<Brain, "updated_at" | "learnings">): Promise<void>;
  appendLearning(l: Learning): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;

  listInbox(filter: { statuses: InboxItem["status"][]; limit?: number }): Promise<InboxItem[]>;
  getInboxItem(id: string): Promise<InboxItem | null>;
  createInboxItems(items: NewInboxItem[]): Promise<InboxItem[]>;
  updateInboxItem(id: string, patch: Partial<InboxItem>): Promise<InboxItem>;

  addDispatchLog(entry: Omit<DispatchLog, "id" | "at">): Promise<void>;
  listDispatchLog(limit: number): Promise<DispatchLog[]>;
  sentCountSince(since: Date): Promise<Partial<Record<Channel, number>>>;
  lastContact(recipientKey: string, excludeItemId: string): Promise<Date | null>;

  listIdeas(status: ContentIdea["status"][], limit?: number): Promise<ContentIdea[]>;
  createIdeas(ideas: NewIdea[]): Promise<ContentIdea[]>;
  updateIdea(id: string, patch: Partial<ContentIdea>): Promise<ContentIdea>;

  listCalendar(from: Date, to: Date): Promise<CalendarEntry[]>;
  getCalendarEntry(id: string): Promise<CalendarEntry | null>;
  createCalendarEntry(e: NewCalendarEntry): Promise<CalendarEntry>;
  updateCalendarEntry(id: string, patch: Partial<CalendarEntry>): Promise<CalendarEntry>;

  listSuppression(): Promise<Suppression[]>;
  addSuppression(value: string, reason: string): Promise<void>;

  startRun(agent: AgentName, trigger: AgentRun["trigger"]): Promise<AgentRun>;
  finishRun(id: string, patch: Partial<AgentRun>): Promise<void>;
  listRuns(limit: number): Promise<AgentRun[]>;
  costSince(since: Date): Promise<number>;
}
