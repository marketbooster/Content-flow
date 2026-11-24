import { describe, expect, it } from "vitest";
import { emptySlotsInWeek, moveToDay, nextFreeSlot, weekVariation } from "@/lib/slots";
import { amsParts, fromAms, startOfAmsWeek } from "@/lib/time";

const now = fromAms(2026, 11, 24, 9, 0); // dinsdag

describe("nextFreeSlot", () => {
  it("LinkedIn: eerstvolgende is woensdag 08:30", () => {
    const at = nextFreeSlot({ channel: "linkedin", format: "post", pillar: "tijd terugwinnen" }, [], now)!;
    expect(at.toISOString()).toBe(fromAms(2026, 11, 25, 8, 30).toISOString());
  });
  it("slaat bezette slots over", () => {
    const at = nextFreeSlot({ channel: "linkedin", format: "post", pillar: "x" }, [{ channel: "linkedin", pillar: "y", slot_at: fromAms(2026, 11, 25, 8, 30).toISOString() }], now)!;
    expect(at.toISOString()).toBe(fromAms(2026, 11, 27, 8, 30).toISOString());
  });
  it("Reel gaat alleen in het Reel-slot (donderdag Instagram)", () => {
    const at = nextFreeSlot({ channel: "instagram", format: "reel", pillar: "x" }, [], now)!;
    expect(amsParts(at).weekday).toBe(4);
  });
  it("geen Reel in een gewoon Instagram-slot", () => {
    const at = nextFreeSlot({ channel: "instagram", format: "carousel", pillar: "x" }, [], now)!;
    expect(amsParts(at).weekday).toBe(2); // dinsdag 12:00 is nog vrij, donderdag is het Reel-slot
  });
  it("max 2× dezelfde pijler per week → volgende week", () => {
    const taken = [
      { channel: "instagram" as const, pillar: "AI-mythbusters", slot_at: fromAms(2026, 11, 26, 12, 0).toISOString() },
      { channel: "instagram" as const, pillar: "AI-mythbusters", slot_at: fromAms(2026, 11, 27, 16, 0).toISOString() },
    ];
    const at = nextFreeSlot({ channel: "linkedin", format: "post", pillar: "AI-mythbusters" }, taken, now)!;
    expect(at.toISOString()).toBe(fromAms(2026, 11, 30, 8, 30).toISOString());
  });
});

describe("weekweergave", () => {
  it("toont lege ritme-slots", () => {
    const week = startOfAmsWeek(now);
    expect(emptySlotsInWeek(week, [])).toHaveLength(6);
    expect(emptySlotsInWeek(week, [{ channel: "linkedin", slot_at: fromAms(2026, 11, 23, 8, 30).toISOString() }])).toHaveLength(5);
  });
  it("slepen behoudt het tijdstip", () => {
    const moved = moveToDay(fromAms(2026, 11, 25, 8, 30), fromAms(2026, 11, 27));
    expect(moved.toISOString()).toBe(fromAms(2026, 11, 27, 8, 30).toISOString());
  });
  it("variatie-waarschuwingen", () => {
    const v = weekVariation([{ pillar: "tijd terugwinnen", tags: [] }]);
    expect(v.warnings).toContain("Nog geen praktijkcase deze week");
    expect(weekVariation([{ pillar: "praktijkcases", tags: ["persoonlijk"] }]).warnings).toEqual([]);
  });
});
