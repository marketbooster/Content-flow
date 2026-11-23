import { describe, expect, it } from "vitest";
import { shootSlides, shotsForItem, splitIntoShots } from "./briefing";
import type { ContentItem } from "./types";

describe("briefing naar shots", () => {
  it("herkent genummerde shots, vervolgregels, verplichte elementen en do's/don'ts", () => {
    const text = `Vermeld altijd #ad en @bodyandfit
1. Intro: laat de shaker zien
Zeg: "Mijn ontbijt in 2 minuten"
2. Product in beeld met logo naar camera
- Afsluiter met kortingscode THIES10
Do: natuurlijk licht
Don't: andere merken in beeld`;
    const r = splitIntoShots(text);
    expect(r.shots.map((s) => s.title)).toEqual([
      "Intro: laat de shaker zien",
      "Product in beeld met logo naar camera",
      "Afsluiter met kortingscode THIES10",
    ]);
    expect(r.shots[0].say).toBe("Mijn ontbijt in 2 minuten");
    expect(r.shots[1].mustInclude).toEqual([]);
    expect(r.shots[2].mustInclude).toEqual(["kortingscode THIES10"]);
    expect(r.alwaysInclude).toEqual(["#ad en @bodyandfit"]);
    expect(r.dos).toEqual(["natuurlijk licht"]);
    expect(r.donts).toEqual(["andere merken in beeld"]);
  });
  it("zonder opsomming wordt elke regel een shot", () => {
    expect(splitIntoShots("Openingsshot keuken\nIngrediënten op tafel\nEindresultaat").shots).toHaveLength(3);
  });
  it("lege tekst geeft geen shots", () => {
    expect(splitIntoShots("  \n ").shots).toEqual([]);
  });
});

const item = (over: Partial<ContentItem>): ContentItem => ({
  id: "c", title: "Tiramisu", pillar: "recepten", format: "reel", status: "idee", createdAt: "", source: "handmatig", ...over,
});

describe("shots voor de opnamemodus", () => {
  it("valt terug op shotlist en daarna op titel + hook", () => {
    expect(shotsForItem(item({ shotlist: ["Close-up", "", "Laagjes"] })).map((s) => s.title)).toEqual(["Close-up", "Laagjes"]);
    const single = shotsForItem(item({ hook: "Tiramisu met kwark" }));
    expect(single).toHaveLength(1);
    expect(single[0].say).toBe("Tiramisu met kwark");
  });
  it("maakt één doorlopende reeks over meerdere video's", () => {
    const slides = shootSlides([item({ id: "a", shotlist: ["1", "2"] }), item({ id: "b" })]);
    expect(slides.map((s) => `${s.item.id}${s.index + 1}/${s.total}`)).toEqual(["a1/2", "a2/2", "b1/1"]);
  });
});
