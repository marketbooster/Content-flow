import { describe, expect, it } from "vitest";
import { dealSignals, dealTotals, exclusivityConflicts } from "./deals";
import { defaultLocation, planShoot, SETUP_MINUTES } from "./shoot";
import type { ContentItem, Deal } from "./types";

const item = (id: string, over: Partial<ContentItem> = {}): ContentItem => ({
  id, title: id, pillar: "recepten", format: "reel", status: "idee", createdAt: "2026-11-01", source: "handmatig",
  productionMinutes: 100, ...over,
});

describe("opnamedag", () => {
  it("leidt een logische locatie af", () => {
    expect(defaultLocation(item("a"))).toBe("keuken");
    expect(defaultLocation(item("b", { pillar: "fitness", title: "Thuisworkout 20 min" }))).toBe("thuis");
    expect(defaultLocation(item("c", { pillar: "humor", title: "Boodschappen doen met peuter" }))).toBe("onderweg");
    expect(defaultLocation(item("d", { location: "buiten" }))).toBe("buiten");
  });
  it("bundelt per locatie, urgentste eerst, binnen de tijd", () => {
    const content = [
      item("k1", { date: "2026-12-10" }), item("k2", { date: "2026-12-03" }),
      item("t1", { pillar: "humor", date: "2026-12-05", productionMinutes: 50 }),
      item("klaar", { status: "gefilmd" }), item("te-laat", { date: "2026-11-20" }),
    ];
    const p = planShoot(content, "2026-12-01", 240);
    const ids = p.groups.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).not.toContain("klaar");
    expect(ids).not.toContain("te-laat");
    expect(p.groups[0].location).toBe("keuken");
    expect(p.groups[0].items.map((i) => i.id)).toEqual(["k2", "k1"]);
    expect(p.totalMinutes).toBe(60 + 60 + 30 + 2 * SETUP_MINUTES);
    expect(p.totalMinutes).toBeLessThanOrEqual(240);
  });
  it("zet wat niet past in leftover", () => {
    const p = planShoot([item("a"), item("b"), item("c")], "2026-12-01", 140);
    expect(p.groups.flatMap((g) => g.items)).toHaveLength(2);
    expect(p.leftover.map((i) => i.id)).toEqual(["c"]);
  });
});

const deal = (id: string, over: Partial<Deal> = {}): Deal => ({
  id, brand: id, platform: "influentials", status: "akkoord", deliverables: "1 reel", category: "sportvoeding",
  notes: "", createdAt: "2026-11-01T10:00:00Z", ...over,
});

describe("samenwerkingen", () => {
  it("signaleert naderende en verstreken deadlines", () => {
    const s = dealSignals([deal("A", { contentDeadline: "2026-11-25" }), deal("B", { contentDeadline: "2026-11-20" })], [], "2026-11-23");
    expect(s.find((x) => x.id === "deadline:A")?.title).toContain("2 dagen");
    expect(s.some((x) => x.id === "deadline-voorbij:B")).toBe(true);
  });
  it("vindt exclusiviteitsconflicten, maar niet bij hetzelfde merk of andere categorie", () => {
    const a = deal("Merk A", { liveDate: "2026-12-01", exclusivity: { category: "Sportvoeding", until: "2027-01-31" } });
    const b = deal("Merk B", { liveDate: "2026-12-20" });
    const c = deal("Merk C", { liveDate: "2026-12-20", category: "kleding" });
    const d = deal("Merk A", { id: "A2", liveDate: "2026-12-20" } as Partial<Deal>);
    const conflicts = exclusivityConflicts([a, b, c, d]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].title).toContain("Merk B");
  });
  it("afgewezen deals tellen niet mee en totalen kloppen", () => {
    const a = deal("A", { exclusivity: { category: "sportvoeding", until: "2027-01-31" }, feeEUR: 500 });
    const b = deal("B", { status: "afgewezen", liveDate: "2026-12-20", feeEUR: 900 });
    expect(exclusivityConflicts([a, b])).toHaveLength(0);
    expect(dealTotals([a, b, deal("C", { status: "betaald", feeEUR: 300 }), deal("D", { status: "aanbod", feeEUR: 250 })]))
      .toEqual({ pipeline: 250, bevestigd: 500, betaald: 300 });
  });
});
