// SEO- en AI-vindbaarheidscheck voor blogconcepten. Pure functies, getest in tests/seo.test.ts.
// Afgestemd op hoe marketbooster.nl/blog rendert: H2's worden de inhoudsopgave,
// "## Veelgestelde vragen" + "### vraag" wordt automatisch FAQPage-schema.

import type { BlogDraft } from "./types";

export interface SeoCheck {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Alle woorden van het zoekwoord komen voor (volgorde vrij; NL-zinnen buigen vaak om). */
export function containsKeyword(text: string, keyword: string): boolean {
  const t = ` ${norm(text)} `;
  return norm(keyword)
    .split(" ")
    .filter((w) => w.length > 2)
    .every((w) => t.includes(` ${w}`));
}

export function wordCount(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / 220));
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function faqQuestions(markdown: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^##\s+.*(veelgestelde vragen|faq)/i.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    const m = lines[i].match(/^###\s+(.+?)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

export function firstParagraph(markdown: string): string {
  return (
    markdown
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith("#")) ?? ""
  );
}

export function internalLinks(markdown: string, site = "marketbooster.nl"): string[] {
  const links = [...markdown.matchAll(/\]\((\/[^)\s]*|https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
  return links.filter((l) => l.startsWith("/") || l.includes(site));
}

export function seoChecks(d: BlogDraft, forbidden: string[] = []): SeoCheck[] {
  const kw = d.primary_keyword;
  const h2 = d.markdown.split("\n").filter((l) => /^##\s/.test(l));
  const words = wordCount(d.markdown);
  const faq = faqQuestions(d.markdown);
  const links = internalLinks(d.markdown);
  const lower = d.markdown.toLowerCase();
  const usedForbidden = forbidden.filter((w) => w && lower.includes(w.toLowerCase()));
  const intro = firstParagraph(d.markdown);
  return [
    { id: "title_len", label: "SEO-titel ≤ 60 tekens", ok: d.seo_title.length > 0 && d.seo_title.length <= 60, detail: `${d.seo_title.length}` },
    { id: "title_kw", label: "Zoekwoord in SEO-titel", ok: containsKeyword(d.seo_title, kw) },
    { id: "desc_len", label: "Meta description 120–160 tekens", ok: d.seo_description.length >= 120 && d.seo_description.length <= 160, detail: `${d.seo_description.length}` },
    { id: "desc_kw", label: "Zoekwoord in meta description", ok: containsKeyword(d.seo_description, kw) },
    { id: "slug", label: "Korte slug met zoekwoord", ok: d.slug === slugify(d.slug) && d.slug.length <= 60 && containsKeyword(d.slug.replace(/-/g, " "), kw) },
    { id: "intro_kw", label: "Zoekwoord in eerste alinea", ok: containsKeyword(intro, kw) },
    { id: "answer_first", label: "Direct antwoord bovenaan (≤ 60 woorden)", ok: intro.length > 0 && wordCount(intro) <= 60 },
    { id: "no_h1", label: "Geen H1 in de tekst (titel is de H1)", ok: !/^#\s/m.test(d.markdown) },
    { id: "h2", label: "Minstens 4 tussenkoppen (H2)", ok: h2.length >= 4, detail: `${h2.length}` },
    { id: "words", label: "900–2200 woorden", ok: words >= 900 && words <= 2200, detail: `${words}` },
    { id: "faq", label: "FAQ-blok met ≥ 3 vragen (FAQ-schema)", ok: faq.length >= 3, detail: `${faq.length}` },
    { id: "links", label: "≥ 2 interne links", ok: links.length >= 2, detail: `${links.length}` },
    { id: "cta", label: "Link naar gratis AI-scan", ok: lower.includes("/gratis-ai-scan") },
    { id: "forbidden", label: "Geen verboden woorden", ok: usedForbidden.length === 0, detail: usedForbidden.join(", ") || undefined },
  ];
}

export const seoScore = (checks: SeoCheck[]) => Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
