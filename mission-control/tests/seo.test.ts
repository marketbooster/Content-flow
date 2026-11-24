import { describe, expect, it } from "vitest";
import { containsKeyword, faqQuestions, internalLinks, seoChecks, seoScore, slugify } from "@/lib/seo";
import type { BlogDraft } from "@/lib/types";

const para = (n: number) => Array.from({ length: n }, () => "Dit is een zin over offertes en tijd.").join(" ");
const good: BlogDraft = {
  slug: "offerte-maken-met-ai",
  seo_title: "Offerte maken met AI: in 10 minuten klaar",
  seo_description: "Offerte maken met AI in 10 minuten? Zo doe je dat als MKB'er: stappenplan, voorbeeldprompt en de valkuilen die je wilt vermijden. Met checklist.",
  excerpt: "x",
  tags: ["ai"],
  primary_keyword: "offerte maken met AI",
  markdown: [
    "Een offerte maken met AI kost je 10 minuten in plaats van een uur. Je geeft je prijslijst en klantvraag, AI schrijft, jij controleert.",
    "## Waarom", para(60), "Lees ook [AI-automation](/blog/ai-automation-6-workflows-mkb).",
    "## Stap 1", para(60), "## Stap 2", para(60), "## Valkuilen", para(50),
    "Doe de [gratis AI-scan](/gratis-ai-scan).",
    "## Veelgestelde vragen", "### Is het veilig?", "Ja.", "### Wat kost het?", "Weinig.", "### Hoe lang duurt het?", "10 minuten.",
  ].join("\n\n"),
};

describe("seo", () => {
  it("zoekwoord matcht los van volgorde en hoofdletters", () => {
    expect(containsKeyword("Met AI een offerte maken", "offerte maken met AI")).toBe(true);
    expect(containsKeyword("Offertes zonder gedoe", "offerte maken met AI")).toBe(false);
  });
  it("slugify", () => expect(slugify("Wat kost een AI-agent? (2026)")).toBe("wat-kost-een-ai-agent-2026"));
  it("leest FAQ zoals marketbooster.nl hem omzet naar schema", () => expect(faqQuestions(good.markdown)).toHaveLength(3));
  it("telt interne links", () => expect(internalLinks(good.markdown)).toEqual(["/blog/ai-automation-6-workflows-mkb", "/gratis-ai-scan"]));
  it("een goed concept haalt alle checks", () => {
    const failed = seoChecks(good).filter((c) => !c.ok);
    expect(failed).toEqual([]);
    expect(seoScore(seoChecks(good))).toBe(100);
  });
  it("vangt fouten", () => {
    const bad = { ...good, seo_title: "x".repeat(70), markdown: "# Titel\n\nKort." };
    const ids = seoChecks(bad, ["kort"]).filter((c) => !c.ok).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["title_len", "no_h1", "words", "faq", "links", "forbidden"]));
  });
});
