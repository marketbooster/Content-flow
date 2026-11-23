// Omzetten van opgeslagen data uit eerdere versies, zodat niemand zijn planning kwijtraakt.
import { DEFAULT_CREATOR } from "../domain/profile";
import type { ContentItem, ContentStatus, CreatorProfile, Deal, IdeaFeedback, SeasonalEvent, ShootDay } from "../domain/types";

export interface AppData {
  version: 2;
  creator: CreatorProfile;
  content: ContentItem[];
  feedback: IdeaFeedback[];
  seenAlerts: string[];
  customEvents: SeasonalEvent[];
  deals: Deal[];
  shootDays: ShootDay[];
}

export const initialData = (): AppData => ({
  version: 2, creator: DEFAULT_CREATOR, content: [], feedback: [], seenAlerts: [], customEvents: [], deals: [], shootDays: [],
});

// Versie 1 kende: idee, gepland, in_productie, klaar, gepubliceerd.
const V1_STATUS: Record<string, ContentStatus> = {
  idee: "idee", gepland: "idee", in_productie: "gefilmd", klaar: "bewerkt", gepubliceerd: "gepubliceerd",
  script: "script", gefilmd: "gefilmd", bewerkt: "bewerkt",
};

export function migrate(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") return initialData();
  const d = raw as Partial<AppData> & { version?: number };
  const content = (d.content ?? []).map((c) => ({ ...c, status: V1_STATUS[c.status as string] ?? "idee" }));
  return {
    ...initialData(),
    ...d,
    version: 2,
    content,
    creator: { ...DEFAULT_CREATOR, ...d.creator },
    deals: d.deals ?? [],
    shootDays: d.shootDays ?? [],
  };
}
