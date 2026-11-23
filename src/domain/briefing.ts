// Briefing → shots, zonder AI. Herkent genummerde/opsommingsregels als shots en haalt
// "moet erin"-regels (hashtags, @merk, kortingscodes, verplicht/noem/zorg dat) eruit.
import type { Briefing, ContentItem, Shot } from "./types";

let counter = 0;
export const shotId = () => `shot-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const BULLET = /^\s*(?:(?:shot|scene|scène|stap)\s*\d+\s*[:.)-]?|\d+\s*[.)-]|[-•*–])\s*/i;
const MUST = /(#\w+|@\w+|\bcode\b|kortingscode|\bverplicht|\bmoet\b|\bnoem\b|\bzorg dat\b|\bvermeld|\blink in bio\b|\bswipe up\b|\bproduct in beeld\b|\blogo\b|\bclaim)/i;
const DO = /^\s*(?:do'?s?|wel|graag)\s*[:-]\s*/i;
const SAY = /^\s*(?:zeg|say|tekst(?: in beeld)?|voice-?over|vo)\s*:\s*/i;
// Concrete verplichte elementen in een shottitel: hashtags, @merk, (kortings)code + waarde.
const TOKENS = /(#[\p{L}\d_]+|@[\p{L}\d_.]+|(?:kortings)?code\s+[A-Z0-9-]{3,})/giu;

const unquote = (t: string) => t.replace(/^["“'‘]+|["”'’]+$/g, "").trim();
const tokensIn = (t: string) => [...t.matchAll(TOKENS)].map((m) => m[1]);
const DONT = /^\s*(?:don'?t'?s?|niet|vermijd|geen)\s*[:-]\s*/i;

export function emptyBriefing(source: Briefing["source"] = "handmatig"): Briefing {
  return { text: "", shots: [], alwaysInclude: [], dos: [], donts: [], images: [], source, updatedAt: new Date().toISOString() };
}

/** Splits vrije tekst in shots. Regels die met een nummer/bullet/"Shot 1" beginnen starten een nieuw shot. */
export function splitIntoShots(text: string): Pick<Briefing, "shots" | "alwaysInclude" | "dos" | "donts"> {
  const shots: Shot[] = [];
  const alwaysInclude: string[] = [];
  const dos: string[] = [];
  const donts: string[] = [];
  let current: Shot | null = null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hasBullets = lines.some((l) => BULLET.test(l));

  for (const line of lines) {
    if (DONT.test(line)) { donts.push(line.replace(DONT, "")); continue; }
    if (DO.test(line)) { dos.push(line.replace(DO, "")); continue; }
    const isBullet = BULLET.test(line);
    const content = line.replace(BULLET, "").trim();
    if (!content) continue;
    if (isBullet || !hasBullets) {
      // Elke opsommingsregel (of elke regel als er geen opsomming is) wordt een shot.
      // In de titel zelf: alleen de concrete elementen (code, #, @) apart als "moet erin".
      current = { id: shotId(), title: content, mustInclude: tokensIn(content) };
      shots.push(current);
    } else if (current) {
      // Vervolgregel onder een shot: verplicht element of uitspraak.
      if (SAY.test(content)) {
        const said = unquote(content.replace(SAY, ""));
        current.say = current.say ? `${current.say} ${said}` : said;
      } else if (MUST.test(content)) current.mustInclude.push(content);
      else current.say = current.say ? `${current.say} ${unquote(content)}` : unquote(content);
    } else if (MUST.test(content)) {
      // Verplichte regel vóór het eerste shot geldt voor de hele video.
      alwaysInclude.push(content.replace(/^(?:(?:vermeld|noem|gebruik)\s+)?altijd\s*:?\s*/i, "") || content);
    }
  }
  return { shots, alwaysInclude, dos, donts };
}

/** Shots voor de opnamemodus: briefing-shots, anders de shotlist, anders één shot met hook en titel. */
export function shotsForItem(c: Pick<ContentItem, "briefing" | "shotlist" | "title" | "hook" | "script">): Shot[] {
  if (c.briefing?.shots.length) return c.briefing.shots;
  const list = (c.shotlist ?? []).map((s) => s.trim()).filter(Boolean);
  if (list.length) return list.map((s, i) => ({ id: `sl-${i}`, title: s, mustInclude: [], say: i === 0 && c.hook ? c.hook : undefined }));
  return [{ id: "main", title: c.title, say: c.hook ?? c.script?.slice(0, 280), mustInclude: [] }];
}

export interface ShootSlide {
  item: ContentItem;
  shot: Shot;
  index: number; // binnen het item
  total: number; // shots in dit item
}

/** Platte volgorde van alle shots van een of meer video's, voor de opnamemodus. */
export function shootSlides(items: ContentItem[]): ShootSlide[] {
  return items.flatMap((item) => {
    const shots = shotsForItem(item);
    return shots.map((shot, index) => ({ item, shot, index, total: shots.length }));
  });
}
