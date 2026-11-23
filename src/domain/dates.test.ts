import { describe, expect, it } from "vitest";
import { easterSunday, koningsdag, lastWeekday, nthWeekday, todayInNL, addDays, diffDays } from "./dates";

describe("easterSunday", () => {
  it.each([
    [2019, "2019-04-21"], [2024, "2024-03-31"], [2025, "2025-04-20"],
    [2026, "2026-04-05"], [2027, "2027-03-28"], [2038, "2038-04-25"],
  ])("%i → %s", (y, d) => expect(easterSunday(y)).toBe(d));
});

describe("weekday rules", () => {
  it("Moederdag = 2e zondag van mei", () => expect(nthWeekday(2026, 5, 0, 2)).toBe("2026-05-10"));
  it("Vaderdag = 3e zondag van juni", () => expect(nthWeekday(2026, 6, 0, 3)).toBe("2026-06-21"));
  it("wintertijd = laatste zondag oktober", () => expect(lastWeekday(2026, 10, 0)).toBe("2026-10-25"));
  it("gooit bij niet-bestaande 5e weekdag", () => expect(() => nthWeekday(2026, 2, 1, 5)).toThrow());
});

describe("koningsdag", () => {
  it("27 april normaal", () => expect(koningsdag(2026)).toBe("2026-04-27"));
  it("26 april als 27 april op zondag valt", () => expect(koningsdag(2025)).toBe("2025-04-26"));
});

describe("tijdzone", () => {
  it("vandaag in NL is al morgen om 23:30 UTC in de zomer", () => {
    expect(todayInNL(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
  });
  it("rekent over zomertijdwissel zonder dagverschuiving", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
  });
});
