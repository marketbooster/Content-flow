// Inbox: tips die geplande taken (Metapic, HEMA, low kcal, voorraad, samenwerkingen) afleveren.
// Schrijven kan alleen met INBOX_TOKEN (niet met het app-wachtwoord); lezen alleen in de app.
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Store } from "./ai/ledger";

export const INBOX_SOURCES = ["metapic", "hema", "lowkcal", "voorraad", "samenwerking", "anders"] as const;
export type InboxSource = (typeof INBOX_SOURCES)[number];

const str = (max: number) => z.string().trim().max(max);
export const InboxItemInput = z.object({
  title: str(200).min(2),
  store: str(80).optional(),
  price: str(40).optional(),
  discount: str(60).optional(),
  url: z.string().trim().url().max(600).optional(),
  idea: str(600).optional(),
  why: str(400).optional(),
  details: str(800).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(str(30)).max(8).optional(),
});
export const InboxPost = z.object({
  source: z.enum(INBOX_SOURCES),
  items: z.array(InboxItemInput).min(1).max(30),
});

export interface InboxItem extends z.infer<typeof InboxItemInput> {
  id: string;
  source: InboxSource;
  status: "nieuw" | "opgepakt" | "afgewezen";
  receivedAt: string;
  key: string;
}

const dedupeKey = (source: string, i: { url?: string; title: string }) =>
  createHash("sha256").update(`${source}|${(i.url ?? i.title).toLowerCase().replace(/[?#].*$/, "")}`).digest("hex").slice(0, 16);

export function sameToken(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export class Inbox {
  constructor(private store: Store<InboxItem[]>, private keepDays = 45) {}

  /** Voegt items toe; dubbelen (zelfde bron + url of titel, ook eerder afgewezen) worden overgeslagen. */
  add(body: z.infer<typeof InboxPost>, now = new Date()): { added: number; skipped: number } {
    const cutoff = new Date(now.getTime() - this.keepDays * 86_400_000).toISOString();
    const all = this.store.load().filter((i) => i.receivedAt >= cutoff || i.status === "nieuw");
    const keys = new Set(all.map((i) => i.key));
    let added = 0;
    for (const item of body.items) {
      const key = dedupeKey(body.source, item);
      if (keys.has(key)) continue;
      keys.add(key);
      all.push({ ...item, id: randomUUID(), source: body.source, status: "nieuw", receivedAt: now.toISOString(), key });
      added++;
    }
    this.store.save(all.slice(-1000));
    return { added, skipped: body.items.length - added };
  }

  list(): InboxItem[] {
    return [...this.store.load()].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  }

  setStatus(id: string, status: InboxItem["status"]): InboxItem | null {
    const all = this.store.load();
    const item = all.find((i) => i.id === id);
    if (!item) return null;
    item.status = status;
    this.store.save(all);
    return item;
  }

  stats() {
    const all = this.store.load();
    const bySource: Record<string, { total: number; nieuw: number; last?: string }> = {};
    for (const i of all) {
      const s = (bySource[i.source] ??= { total: 0, nieuw: 0 });
      s.total++;
      if (i.status === "nieuw") s.nieuw++;
      if (!s.last || i.receivedAt > s.last) s.last = i.receivedAt;
    }
    return { total: all.length, bySource };
  }
}
