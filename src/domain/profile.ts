import { DEFAULT_PREP_STAGES } from "./relevance";
import type { CreatorProfile, PillarId } from "./types";

export const PILLAR_LABELS: Record<PillarId, string> = {
  afvallen: "Afvallen en leefstijl",
  recepten: "Low-cal en eiwitrijke recepten",
  fitness: "Fitness en beweging",
  pcos: "PCOS",
  moederschap: "Moederschap",
  humor: "Humor en herkenbaarheid",
  ontwikkeling: "Persoonlijke ontwikkeling",
  samenwerkingen: "Lifestyle en samenwerkingen",
};

export const PILLAR_SHORT: Record<PillarId, string> = {
  afvallen: "Afvallen",
  recepten: "Recepten",
  fitness: "Fitness",
  pcos: "PCOS",
  moederschap: "Moederschap",
  humor: "Humor",
  ontwikkeling: "Ontwikkeling",
  samenwerkingen: "Samenwerkingen",
};

export const DEFAULT_CREATOR: CreatorProfile = {
  id: "fitmetthies",
  name: "FitMetThies",
  handle: "@fitmetthies",
  pillars: [
    { id: "afvallen", label: PILLAR_LABELS.afvallen, weight: 1 },
    { id: "recepten", label: PILLAR_LABELS.recepten, weight: 1 },
    { id: "fitness", label: PILLAR_LABELS.fitness, weight: 0.7 },
    { id: "pcos", label: PILLAR_LABELS.pcos, weight: 0.8 },
    { id: "moederschap", label: PILLAR_LABELS.moederschap, weight: 0.9 },
    { id: "humor", label: PILLAR_LABELS.humor, weight: 0.8 },
    { id: "ontwikkeling", label: PILLAR_LABELS.ontwikkeling, weight: 0.6 },
    { id: "samenwerkingen", label: PILLAR_LABELS.samenwerkingen, weight: 0.7 },
  ],
  hoursPerWeek: 8,
  brandVoice:
    "Eerlijk, warm en nuchter met humor. Geen crash-diëten, geen schuldgevoel. Persoonlijke ervaring, geen medisch advies.",
  audience: "Nederlandse vrouwen 25–45, vaak moeder, bezig met afvallen en een gezonde leefstijl; deels met PCOS.",
  region: "NL",
  prepDefaults: DEFAULT_PREP_STAGES,
  notifications: {
    enabled: true,
    maxPerWeek: 3,
    minRelevance: 55,
    stages: ["samenwerking", "concept", "productie", "publicatie", "dag_zelf"],
  },
  mutedEventIds: [],
  blockedTopics: [],
};
