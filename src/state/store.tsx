// App-state. MVP: één creator, opgeslagen in localStorage via een repository-laag, zodat dit
// later 1-op-1 vervangen kan worden door Supabase (zie supabase/migrations).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, todayInNL } from "../domain/dates";
import { SEASONAL_EVENTS } from "../domain/events";
import { occurrencesBetween } from "../domain/occurrences";
import { DEFAULT_CREATOR } from "../domain/profile";
import type {
  ContentItem, CreatorProfile, EventOccurrence, IdeaFeedback, SeasonalEvent, SwipeDecision,
} from "../domain/types";

export interface AppData {
  version: 1;
  creator: CreatorProfile;
  content: ContentItem[];
  feedback: IdeaFeedback[];
  seenAlerts: string[];
  customEvents: SeasonalEvent[];
}

const STORAGE_KEY = "contentflow:v1";

const initial = (): AppData => ({
  version: 1, creator: DEFAULT_CREATOR, content: [], feedback: [], seenAlerts: [], customEvents: [],
});

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as AppData;
    return { ...initial(), ...parsed, creator: { ...DEFAULT_CREATOR, ...parsed.creator } };
  } catch {
    return initial();
  }
}

function save(d: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* opslag niet beschikbaar (privévenster): app werkt, maar onthoudt niets */
  }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

interface Store extends AppData {
  today: string;
  events: SeasonalEvent[];
  occurrences: EventOccurrence[]; // komende ~13 maanden + afgelopen maand
  updateCreator: (patch: Partial<CreatorProfile>) => void;
  addContent: (items: Omit<ContentItem, "id" | "createdAt">[]) => string[];
  updateContent: (id: string, patch: Partial<ContentItem>) => void;
  removeContent: (id: string) => void;
  decide: (ideaKey: string, decision: SwipeDecision) => void;
  undoDecision: (ideaKey: string) => void;
  markAlertsSeen: (keys: string[]) => void;
  addCustomEvent: (ev: SeasonalEvent) => void;
  removeCustomEvent: (id: string) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);
  const today = todayInNL();
  useEffect(() => save(data), [data]);

  const events = useMemo(() => [...SEASONAL_EVENTS, ...data.customEvents], [data.customEvents]);
  const occurrences = useMemo(
    () => occurrencesBetween(events, addDays(today, -31), addDays(today, 400), today),
    [events, today],
  );

  const update = useCallback((f: (d: AppData) => AppData) => setData((d) => f(d)), []);

  const store: Store = {
    ...data,
    today,
    events,
    occurrences,
    updateCreator: (patch) => update((d) => ({ ...d, creator: { ...d.creator, ...patch } })),
    addContent: (items) => {
      const created = items.map((i) => ({ ...i, id: uid(), createdAt: new Date().toISOString() }));
      update((d) => {
        // Ontdubbelen: hetzelfde idee voor hetzelfde moment komt er maar één keer in.
        const existing = new Set(d.content.filter((c) => c.ideaTemplateId).map((c) => `${c.ideaTemplateId}@${c.eventKey ?? c.date?.slice(0, 7)}`));
        const fresh = created.filter((c) => !c.ideaTemplateId || !existing.has(`${c.ideaTemplateId}@${c.eventKey ?? c.date?.slice(0, 7)}`));
        return { ...d, content: [...d.content, ...fresh] };
      });
      return created.map((c) => c.id);
    },
    updateContent: (id, patch) =>
      update((d) => ({ ...d, content: d.content.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    removeContent: (id) => update((d) => ({ ...d, content: d.content.filter((c) => c.id !== id) })),
    decide: (ideaKey, decision) =>
      update((d) => ({
        ...d,
        feedback: [...d.feedback.filter((f) => f.ideaKey !== ideaKey), { ideaKey, decision, at: new Date().toISOString() }],
      })),
    undoDecision: (ideaKey) => update((d) => ({ ...d, feedback: d.feedback.filter((f) => f.ideaKey !== ideaKey) })),
    markAlertsSeen: (keys) => update((d) => ({ ...d, seenAlerts: [...new Set([...d.seenAlerts, ...keys])] })),
    addCustomEvent: (ev) => update((d) => ({ ...d, customEvents: [...d.customEvents.filter((e) => e.id !== ev.id), ev] })),
    removeCustomEvent: (id) => update((d) => ({ ...d, customEvents: d.customEvents.filter((e) => e.id !== id) })),
    reset: () => setData(initial()),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore buiten StoreProvider");
  return s;
}
