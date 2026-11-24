// Tips van je geplande taken (Metapic, HEMA, low kcal, voorraad, samenwerkingen), van de server.
import { useCallback, useEffect, useState } from "react";

export type InboxSource = "metapic" | "hema" | "lowkcal" | "voorraad" | "samenwerking" | "anders";

export interface InboxItem {
  id: string;
  source: InboxSource;
  status: "nieuw" | "opgepakt" | "afgewezen";
  receivedAt: string;
  title: string;
  store?: string;
  price?: string;
  discount?: string;
  url?: string;
  idea?: string;
  why?: string;
  details?: string;
  validUntil?: string;
  tags?: string[];
}

export const SOURCE_INFO: Record<InboxSource, { label: string; emoji: string }> = {
  metapic: { label: "Metapic", emoji: "💸" },
  hema: { label: "HEMA viral", emoji: "🔥" },
  lowkcal: { label: "Low kcal", emoji: "🥗" },
  voorraad: { label: "Voorraad", emoji: "📦" },
  samenwerking: { label: "Samenwerking", emoji: "🤝" },
  anders: { label: "Tip", emoji: "💡" },
};

const preview = Boolean(import.meta.env.VITE_PREVIEW);

export function useInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (preview) return;
    try {
      const r = await fetch("/api/inbox");
      if (!r.ok) throw new Error(`Inbox niet bereikbaar (${r.status})`);
      const body = (await r.json()) as { configured: boolean; items: InboxItem[] };
      setItems(body.items);
      setConfigured(body.configured);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const setStatus = useCallback(async (id: string, status: InboxItem["status"]) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x))); // direct in beeld
    try {
      await fetch(`/api/inbox/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    } catch {
      load();
    }
  }, [load]);

  return { items, fresh: items.filter((i) => i.status === "nieuw"), configured, error, preview, setStatus, reload: load };
}
