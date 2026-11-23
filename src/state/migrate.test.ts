import { describe, expect, it } from "vitest";
import { migrate } from "./migrate";

describe("migratie van opgeslagen data", () => {
  it("zet v1-statussen om en vult nieuwe velden aan", () => {
    const v1 = {
      version: 1,
      creator: { name: "X", hoursPerWeek: 5 },
      content: [
        { id: "a", status: "gepland" }, { id: "b", status: "in_productie" }, { id: "c", status: "klaar" },
        { id: "d", status: "gepubliceerd" }, { id: "e", status: "onzin" },
      ],
      feedback: [], seenAlerts: [], customEvents: [],
    };
    const v2 = migrate(v1);
    expect(v2.version).toBe(2);
    expect(v2.content.map((c) => c.status)).toEqual(["idee", "gefilmd", "bewerkt", "gepubliceerd", "idee"]);
    expect(v2.deals).toEqual([]);
    expect(v2.shootDays).toEqual([]);
    expect(v2.creator.hoursPerWeek).toBe(5);
    expect(v2.creator.pillars.length).toBe(8); // aangevuld uit de standaard
  });
  it("lege of kapotte data geeft een schone start", () => {
    expect(migrate(null).content).toEqual([]);
    expect(migrate("rommel").version).toBe(2);
  });
});
