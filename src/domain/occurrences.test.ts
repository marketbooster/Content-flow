import { describe, expect, it } from "vitest";
import { SEASONAL_EVENTS } from "./events";
import { occurrencesBetween } from "./occurrences";
import type { SeasonalEvent } from "./types";

const today = "2026-11-23";
const find = (id: string, from: string, to: string) =>
  occurrencesBetween(SEASONAL_EVENTS, from, to, today).filter((o) => o.eventId === id);

describe("occurrencesBetween", () => {
  it("Black Friday en Cyber Monday 2026", () => {
    expect(find("black-friday", "2026-11-01", "2026-11-30")[0].start).toBe("2026-11-27");
    expect(find("cyber-monday", "2026-11-01", "2026-12-31")[0].start).toBe("2026-11-30");
  });
  it("Carnaval, Hemelvaart en Pinksteren 2026 uit Pasen", () => {
    expect(find("carnaval", "2026-01-01", "2026-12-31")[0]).toMatchObject({ start: "2026-02-15", end: "2026-02-17" });
    expect(find("hemelvaart", "2026-01-01", "2026-12-31")[0].start).toBe("2026-05-14");
    expect(find("pinksteren", "2026-01-01", "2026-12-31")[0]).toMatchObject({ start: "2026-05-24", end: "2026-05-25" });
  });
  it("maand-events beslaan de hele maand", () => {
    expect(find("pcos-awareness-month", "2026-09-10", "2026-09-10")[0]).toMatchObject({ start: "2026-09-01", end: "2026-09-30" });
  });
  it("vangt events die vóór de periode begonnen maar erin doorlopen (jaargrens)", () => {
    const kv = find("kerstvakantie", "2027-01-01", "2027-01-05");
    expect(kv).toHaveLength(1);
    expect(kv[0].reliability).toBe("te_verifieren");
  });
  it("geen dubbele voorkomens en gesorteerd", () => {
    const all = occurrencesBetween(SEASONAL_EVENTS, "2026-01-01", "2027-12-31", today);
    expect(new Set(all.map((o) => o.key)).size).toBe(all.length);
    const starts = all.map((o) => o.start);
    expect([...starts].sort()).toEqual(starts);
  });
  it("berekende datums zijn 'berekend', vaste 'betrouwbaar'", () => {
    expect(find("pasen", "2026-01-01", "2026-12-31")[0].reliability).toBe("berekend");
    expect(find("sinterklaas", "2026-12-01", "2026-12-31")[0].reliability).toBe("betrouwbaar");
  });
  it("trends zonder bron zijn te verifiëren en verlopen trends verdwijnen", () => {
    const base: SeasonalEvent = {
      id: "t", name: "Trend", type: "trend", dateKind: "trend", region: "NL",
      rule: { kind: "explicit", occurrences: [{ start: "2026-11-20", end: "2026-11-30" }] },
      pillarFit: {}, audiences: [], contentCategories: [], source: { label: "?" }, weight: 1,
    };
    expect(occurrencesBetween([base], "2026-11-01", "2026-11-30", today)[0].reliability).toBe("te_verifieren");
    const expired = { ...base, source: { label: "x", url: "https://x" }, lastVerified: "2026-11-01", expiresAt: "2026-11-22" };
    expect(occurrencesBetween([expired], "2026-11-01", "2026-11-30", today)).toHaveLength(0);
  });
});
