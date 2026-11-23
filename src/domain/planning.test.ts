import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { SEASONAL_EVENTS } from "./events";
import { ideasFor } from "./ideas";
import { analyzeMix } from "./mix";
import { planMonth } from "./monthPlanner";
import { occurrencesBetween } from "./occurrences";
import { DEFAULT_CREATOR } from "./profile";
import { currentStage, prepAlerts, relevanceFor } from "./relevance";
import type { ContentItem, CreatorProfile } from "./types";

const today = "2026-11-23";
const ev = (id: string) => SEASONAL_EVENTS.find((e) => e.id === id)!;
const occs = occurrencesBetween(SEASONAL_EVENTS, today, addDays(today, 90), today);
const occ = (id: string) => occs.find((o) => o.eventId === id)!;

describe("relevance", () => {
  it("Sinterklaas en Kerst zijn zeer relevant voor FitMetThies", () => {
    expect(relevanceFor(ev("sinterklaas"), DEFAULT_CREATOR).score).toBeGreaterThanOrEqual(85);
    expect(relevanceFor(ev("kerst"), DEFAULT_CREATOR).score).toBeGreaterThanOrEqual(85);
  });
  it("uitgezette momenten scoren 0", () => {
    const c: CreatorProfile = { ...DEFAULT_CREATOR, mutedEventIds: ["kerst"] };
    expect(relevanceFor(ev("kerst"), c).score).toBe(0);
  });
  it("regionale momenten buiten je regio krijgen een korting", () => {
    expect(relevanceFor(ev("carnaval"), DEFAULT_CREATOR).reason).toContain("regionaal");
  });
});

describe("voorbereiding", () => {
  it("Sinterklaas zit 12 dagen vooraf in de productiefase", () => {
    const s = currentStage(ev("sinterklaas"), occ("sinterklaas"), DEFAULT_CREATOR, today)!;
    expect(s.daysUntil).toBe(12);
    expect(s.stage.id).toBe("productie");
  });
  it("meldingen zijn begrensd, eenmalig en per moment maximaal één", () => {
    const alerts = prepAlerts(SEASONAL_EVENTS, occs, DEFAULT_CREATOR, today, new Set());
    expect(alerts.length).toBeLessThanOrEqual(DEFAULT_CREATOR.notifications.maxPerWeek);
    expect(new Set(alerts.map((a) => a.occurrence.key)).size).toBe(alerts.length);
    const again = prepAlerts(SEASONAL_EVENTS, occs, DEFAULT_CREATOR, today, new Set(alerts.map((a) => a.key)));
    expect(again.some((a) => alerts.some((b) => b.key === a.key))).toBe(false);
  });
  it("uitgeschakelde meldingen geven niets", () => {
    const c = { ...DEFAULT_CREATOR, notifications: { ...DEFAULT_CREATOR.notifications, enabled: false } };
    expect(prepAlerts(SEASONAL_EVENTS, occs, c, today, new Set())).toHaveLength(0);
  });
});

describe("ideeën", () => {
  it("geeft Sinterklaas-ideeën en ontdubbelt afgewezen en ingeplande", () => {
    const o = occ("sinterklaas");
    const all = ideasFor(o, DEFAULT_CREATOR, [], []);
    expect(all.length).toBeGreaterThanOrEqual(6);
    const [first, second] = all;
    const content: ContentItem[] = [{
      id: "c1", title: second.template.title, pillar: second.template.pillar, format: second.template.format,
      status: "gepland", date: second.idealPublishDate, eventKey: o.key, ideaTemplateId: second.template.id,
      createdAt: today, source: "seasonal",
    }];
    const rest = ideasFor(o, DEFAULT_CREATOR, [{ ideaKey: first.key, decision: "afgewezen", at: today }], content);
    expect(rest.map((r) => r.key)).not.toContain(first.key);
    expect(rest.map((r) => r.key)).not.toContain(second.key);
  });
  it("filtert uitgesloten onderwerpen", () => {
    const c = { ...DEFAULT_CREATOR, blockedTopics: ["kruidnoten"] };
    expect(ideasFor(occ("sinterklaas"), c, [], []).some((i) => i.template.tags.includes("kruidnoten"))).toBe(false);
  });
});

describe("contentmix", () => {
  const item = (id: string, over: Partial<ContentItem>): ContentItem => ({
    id, title: id, pillar: "recepten", format: "reel", status: "gepland", date: "2026-11-30",
    createdAt: today, source: "handmatig", ...over,
  });
  it("signaleert eenzijdig format en onbenutte kansen, zonder iets te wijzigen", () => {
    const content = [1, 2, 3, 4, 5].map((n) => item(`c${n}`, { date: addDays(today, n * 3) }));
    const snapshot = JSON.stringify(content);
    const s = analyzeMix(content, DEFAULT_CREATOR, SEASONAL_EVENTS, occs, today);
    expect(s.some((x) => x.kind === "format_eenzijdig")).toBe(true);
    expect(s.some((x) => x.kind === "onderwerp_herhaalt")).toBe(true);
    expect(s.some((x) => x.kind === "kans_onbenut" && x.relatedOccurrenceKey === occ("kerst").key)).toBe(true);
    expect(JSON.stringify(content)).toBe(snapshot);
  });
  it("signaleert content die ná het moment gepland staat", () => {
    const o = occ("sinterklaas");
    const s = analyzeMix([item("x", { eventKey: o.key, date: "2026-12-10" })], DEFAULT_CREATOR, SEASONAL_EVENTS, occs, today);
    expect(s.some((x) => x.kind === "te_laat" && x.id === "na:x")).toBe(true);
  });
});

describe("maandplanning", () => {
  it("plant december binnen capaciteit, met mix en zonder dubbelingen", () => {
    const r = planMonth({ year: 2026, month: 12, creator: DEFAULT_CREATOR, events: SEASONAL_EVENTS, content: [], feedback: [], today });
    expect(r.proposals.length).toBeGreaterThan(4);
    expect(r.usedMinutes).toBeLessThanOrEqual(r.capacityMinutes);
    expect(new Set(r.proposals.map((p) => p.key)).size).toBe(r.proposals.length);
    expect(new Set(r.proposals.map((p) => p.template.pillar)).size).toBeGreaterThanOrEqual(3);
    expect(r.proposals.some((p) => p.occurrence?.eventId === "kerst")).toBe(true);
    for (const p of r.proposals) expect(p.date >= "2026-12-01" && p.date <= "2026-12-31").toBe(true);
  });
  it("respecteert weinig beschikbare tijd", () => {
    const c = { ...DEFAULT_CREATOR, hoursPerWeek: 1 };
    const r = planMonth({ year: 2026, month: 12, creator: c, events: SEASONAL_EVENTS, content: [], feedback: [], today });
    expect(r.usedMinutes).toBeLessThanOrEqual(r.capacityMinutes);
  });
});
