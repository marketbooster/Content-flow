// App-state. MVP: één creator, opgeslagen in localStorage via een repository-laag, zodat dit
// later 1-op-1 vervangen kan worden door Supabase (zie supabase/migrations).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, todayInNL } from "../domain/dates";
import { SEASONAL_EVENTS } from "../domain/events";
import { occurrencesBetween } from "../domain/occurrences";
import type {
  ContentItem, CreatorProfile, Deal, EventOccurrence, SeasonalEvent, ShootDay, SwipeDecision,
} from "../domain/types";
import { type AppData, initialData, migrate } from "./migrate";

export type { AppData };

// De sleutel blijft gelijk; de inhoud wordt bij het laden gemigreerd.
const STORAGE_KEY = "contentflow:v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : initialData();
  } catch {
    return initialData();
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
  occurrences: EventOccurrence[]; // afgelopen maand + komende ~13 maanden
  updateCreator: (patch: Partial<CreatorProfile>) => void;
  addContent: (items: Omit<ContentItem, "id" | "createdAt">[]) => string[];
  updateContent: (id: string, patch: Partial<ContentItem>) => void;
  updateManyContent: (ids: string[], patch: Partial<ContentItem>) => void;
  removeContent: (id: string) => void;
  decide: (ideaKey: string, decision: SwipeDecision) => void;
  undoDecision: (ideaKey: string) => void;
  markAlertsSeen: (keys: string[]) => void;
  addCustomEvent: (ev: SeasonalEvent) => void;
  removeCustomEvent: (id: string) => void;
  saveDeal: (deal: Omit<Deal, "id" | "createdAt"> & { id?: string }) => string;
  removeDeal: (id: string) => void;
  saveShootDay: (day: Omit<ShootDay, "id" | "createdAt"> & { id?: string }) => string;
  removeShootDay: (id: string) => void;
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
        const key = (c: ContentItem) => `${c.ideaTemplateId}@${c.eventKey ?? c.date?.slice(0, 7)}`;
        const existing = new Set(d.content.filter((c) => c.ideaTemplateId).map(key));
        const fresh = created.filter((c) => !c.ideaTemplateId || !existing.has(key(c)));
        return { ...d, content: [...d.content, ...fresh] };
      });
      return created.map((c) => c.id);
    },
    updateContent: (id, patch) =>
      update((d) => ({ ...d, content: d.content.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    updateManyContent: (ids, patch) =>
      update((d) => ({ ...d, content: d.content.map((c) => (ids.includes(c.id) ? { ...c, ...patch } : c)) })),
    removeContent: (id) =>
      update((d) => ({
        ...d,
        content: d.content.filter((c) => c.id !== id),
        shootDays: d.shootDays.map((s) => ({ ...s, contentIds: s.contentIds.filter((x) => x !== id) })),
      })),
    decide: (ideaKey, decision) =>
      update((d) => ({
        ...d,
        feedback: [...d.feedback.filter((f) => f.ideaKey !== ideaKey), { ideaKey, decision, at: new Date().toISOString() }],
      })),
    undoDecision: (ideaKey) => update((d) => ({ ...d, feedback: d.feedback.filter((f) => f.ideaKey !== ideaKey) })),
    markAlertsSeen: (keys) => update((d) => ({ ...d, seenAlerts: [...new Set([...d.seenAlerts, ...keys])] })),
    addCustomEvent: (ev) => update((d) => ({ ...d, customEvents: [...d.customEvents.filter((e) => e.id !== ev.id), ev] })),
    removeCustomEvent: (id) => update((d) => ({ ...d, customEvents: d.customEvents.filter((e) => e.id !== id) })),
    saveDeal: (deal) => {
      const id = deal.id ?? uid();
      update((d) => {
        const prev = d.deals.find((x) => x.id === id);
        const next: Deal = { ...(prev ?? { createdAt: new Date().toISOString() }), ...deal, id } as Deal;
        return { ...d, deals: prev ? d.deals.map((x) => (x.id === id ? next : x)) : [...d.deals, next] };
      });
      return id;
    },
    removeDeal: (id) =>
      update((d) => ({
        ...d,
        deals: d.deals.filter((x) => x.id !== id),
        content: d.content.map((c) => (c.dealId === id ? { ...c, dealId: undefined } : c)),
      })),
    saveShootDay: (day) => {
      const id = day.id ?? uid();
      update((d) => {
        const prev = d.shootDays.find((x) => x.id === id);
        const next: ShootDay = { ...(prev ?? { createdAt: new Date().toISOString() }), ...day, id } as ShootDay;
        return { ...d, shootDays: prev ? d.shootDays.map((x) => (x.id === id ? next : x)) : [...d.shootDays, next] };
      });
      return id;
    },
    removeShootDay: (id) => update((d) => ({ ...d, shootDays: d.shootDays.filter((x) => x.id !== id) })),
    reset: () => setData(initialData()),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore buiten StoreProvider");
  return s;
}
