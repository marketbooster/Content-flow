"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import type { InboxItem } from "@/lib/types";
import { REJECT_REASONS } from "@/lib/types";
import {
  approveItem,
  bulkApprove,
  confirmManualSend,
  dispatchNow,
  editItem,
  rejectItem,
  rewriteAction,
  snoozeItem,
  undoApprove,
} from "@/app/actions";
import { ChannelIcon, channelLabel, typeLabel } from "./channel";
import { ItemPreview } from "./item-preview";
import { Sheet, TextButton, PrimaryButton, SecondaryButton, Chip } from "./ui";
import { formatDayTime } from "@/lib/time";

export interface CardData {
  item: InboxItem;
  slides: string[];
  route: { kind: "api" | "manual" | "none"; label: string; ready: boolean };
  manual: { clipboard: string; openUrl: string | null } | null;
  blocked: string | null;
}

type Mode = "view" | "edit" | "rewrite" | "later" | "reject" | "manual-confirm";
interface Toast {
  text: string;
  undoId?: string;
}

const SECONDS_PER_CARD = 70;
const UNDO_MS = 5000;

export function TodayClient(props: {
  greeting: string;
  cards: CardData[];
  doneToday: number;
  waitingCount: number;
  paused: boolean;
  budget: "ok" | "warn" | "stop";
}) {
  const router = useRouter();
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [doneLocal, setDoneLocal] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [toast, setToast] = useState<Toast | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groupKey = (c: CardData) => `${c.item.channel}:${c.item.type}`;
  const queue = props.cards.filter((c) => !handled.has(c.item.id));
  const groups = useMemo(() => {
    const m = new Map<string, CardData[]>();
    for (const c of queue) m.set(groupKey(c), [...(m.get(groupKey(c)) ?? []), c]);
    return [...m.entries()];
  }, [queue]);
  const shown = filter ? queue.filter((c) => groupKey(c) === filter) : queue;
  const current = shown[0];
  const total = props.doneToday + doneLocal + queue.length;
  const progress = total === 0 ? 1 : (props.doneToday + doneLocal) / total;

  useEffect(() => setMode("view"), [current?.item.id]);
  useEffect(() => {
    if (filter && !queue.some((c) => groupKey(c) === filter)) setFilter(null);
  }, [filter, queue]);

  function showToast(t: Toast, ms = 2500) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }
  function hide(id: string) {
    setHandled((h) => new Set(h).add(id));
    setDoneLocal((n) => n + 1);
  }
  function unhide(id: string) {
    setHandled((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });
    setDoneLocal((n) => n - 1);
  }

  // ── Verzend (API-kanalen): 5 seconden ongedaan maken, daarna de dispatcher ──
  async function send(card: CardData) {
    const id = card.item.id;
    hide(id);
    const res = await approveItem(id);
    if (!res.ok) {
      unhide(id);
      return showToast({ text: res.error });
    }
    showToast({ text: "Verzonden", undoId: id }, UNDO_MS);
    timers.current.set(
      id,
      setTimeout(async () => {
        timers.current.delete(id);
        const out = await dispatchNow(id);
        if (!out.ok) return showToast({ text: out.error }, 4000);
        const d = out.data!;
        if (d.outcome === "deferred") showToast({ text: `Gepland · ${formatDayTime(d.until)}` });
        else if (d.outcome === "blocked" || d.outcome === "failed") showToast({ text: `Niet verzonden: ${d.detail}` }, 5000);
      }, UNDO_MS),
    );
  }

  async function undo(id: string) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToast(null);
    const res = await undoApprove(id);
    if (res.ok) unhide(id);
    else showToast({ text: res.error });
  }

  // ── 1-tap: kopieer en open, daarna bevestig je ──
  async function copyAndOpen(card: CardData) {
    if (!card.manual) return;
    try {
      await navigator.clipboard.writeText(card.manual.clipboard);
    } catch {
      /* klembord geweigerd: tekst staat nog op de kaart */
    }
    if (card.manual.openUrl) window.open(card.manual.openUrl, "_blank", "noopener");
    setMode("manual-confirm");
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return showToast({ text: res.error ?? "Er ging iets mis" });
      after?.();
      router.refresh();
    });
  }

  const remaining = queue.length;
  const minutes = Math.max(1, Math.round((remaining * SECONDS_PER_CARD) / 60));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <header>
        <h1 className="t-title">{props.greeting}</h1>
        <p className="t-meta mt-1">
          {remaining > 0 ? (
            <>
              <span className="t-num">{remaining}</span> {remaining === 1 ? "actie" : "acties"} · ±{" "}
              <span className="t-num">{minutes}</span> min
            </>
          ) : (
            "Alles gedaan"
          )}
          {props.waitingCount > 0 && <> · <span className="t-num">{props.waitingCount}</span> gepland</>}
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      {props.paused && (
        <Link href="/profiel" className="rounded-[16px] bg-wait p-4 text-wait-ink">
          Alles staat op pauze. Agents en verzendingen liggen stil. <span className="underline">Hervat</span>
        </Link>
      )}
      {props.budget !== "ok" && (
        <Link href="/profiel" className="rounded-[16px] bg-wait p-4 text-wait-ink">
          {props.budget === "stop" ? "Maandplafond API-kosten bereikt. Agents staan stil." : "80% van je maandplafond voor API-kosten is op."}{" "}
          <span className="underline">Bekijk kosten</span>
        </Link>
      )}

      {groups.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filter op type">
          <Chip active={!filter} onClick={() => setFilter(null)}>
            Alles <span className="t-num">{queue.length}</span>
          </Chip>
          {groups.map(([key, list]) => (
            <Chip key={key} active={filter === key} onClick={() => setFilter(key)}>
              {channelLabel(list[0].item.channel)} · {typeLabel(list[0].item.type)} <span className="t-num">{list.length}</span>
            </Chip>
          ))}
        </div>
      )}

      {filter && shown.length > 1 && shown.every((c) => c.route.kind === "api" && c.route.ready) && (
        <SecondaryButton onClick={() => setBulkOpen(true)}>Verzend alle {shown.length}</SecondaryButton>
      )}

      {current ? (
        <div className="relative">
          {/* De stapel erachter */}
          {shown[2] && <div aria-hidden className="absolute inset-x-6 -bottom-3 h-full rounded-[16px] bg-surface opacity-60" />}
          {shown[1] && <div aria-hidden className="absolute inset-x-3 -bottom-1.5 h-full rounded-[16px] bg-surface" />}
          <SwipeCard
            key={current.item.id}
            card={current}
            onRight={() => (current.manual ? copyAndOpen(current) : current.route.ready && !current.blocked && send(current))}
            onLeft={() => setMode("reject")}
            onUp={() => setMode("edit")}
          >
            <CardBody card={current} />
          </SwipeCard>
        </div>
      ) : (
        <Empty />
      )}

      {current && mode === "view" && (
        <div className="flex flex-col gap-3">
          {current.blocked ? (
            <p className="rounded-[12px] bg-wait p-3 text-wait-ink">Geblokkeerd: {current.blocked}</p>
          ) : current.manual ? (
            <PrimaryButton onClick={() => copyAndOpen(current)}>Kopieer en open</PrimaryButton>
          ) : current.route.ready ? (
            <PrimaryButton onClick={() => send(current)}>Verzend</PrimaryButton>
          ) : (
            <p className="t-meta rounded-[12px] bg-surface p-3">
              {current.route.label} is nog niet gekoppeld. <Link href="/profiel#koppelingen" className="underline">Koppelingen</Link>
            </p>
          )}
          <div className="flex justify-between">
            <TextButton onClick={() => setMode("edit")}>Bewerk</TextButton>
            <TextButton onClick={() => setMode("rewrite")}>Herschrijf</TextButton>
            <TextButton onClick={() => setMode("later")}>Later</TextButton>
            <TextButton onClick={() => setMode("reject")}>Weg</TextButton>
          </div>
        </div>
      )}

      {current && mode === "reject" && (
        <Sheet title="Waarom weg?" onClose={() => setMode("view")}>
          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <Chip key={r} onClick={() => act(() => rejectItem(current.item.id, r), () => hide(current.item.id))}>
                {r}
              </Chip>
            ))}
          </div>
        </Sheet>
      )}

      {current && mode === "later" && (
        <Sheet title="Wanneer terug in de stapel?" onClose={() => setMode("view")}>
          <div className="flex flex-wrap gap-2">
            {[
              ["Morgen", 1],
              ["Overmorgen", 2],
              ["Volgende week", 7],
              ["Over 2 weken", 14],
            ].map(([label, days]) => (
              <Chip key={label} onClick={() => act(() => snoozeItem(current.item.id, days as number), () => hide(current.item.id))}>
                {label}
              </Chip>
            ))}
          </div>
        </Sheet>
      )}

      {current && mode === "edit" && (
        <EditSheet
          card={current}
          pending={pending}
          onCancel={() => setMode("view")}
          onSave={(body, fc) => act(() => editItem(current.item.id, body, fc), () => setMode("view"))}
        />
      )}

      {current && mode === "rewrite" && (
        <RewriteSheet
          pending={pending}
          onCancel={() => setMode("view")}
          onSubmit={(instruction) => act(() => rewriteAction(current.item.id, instruction), () => setMode("view"))}
        />
      )}

      {current && mode === "manual-confirm" && (
        <Sheet title="Geplaatst?" onClose={() => setMode("view")}>
          <p className="t-meta mb-3">De tekst staat op je klembord. Plak en verstuur, kom dan terug.</p>
          <div className="flex gap-2">
            <SecondaryButton
              onClick={() =>
                act(() => confirmManualSend(current.item.id), () => {
                  hide(current.item.id);
                  showToast({ text: "Verzonden" });
                })
              }
            >
              Ja, verzonden
            </SecondaryButton>
            <TextButton onClick={() => setMode("view")}>Nog niet</TextButton>
          </div>
        </Sheet>
      )}

      {bulkOpen && filter && (
        <Sheet title={`${shown.length} items verzenden?`} onClose={() => setBulkOpen(false)}>
          <p className="mb-4">
            <span className="t-num">{shown.length}</span>× {channelLabel(shown[0].item.channel)} · {typeLabel(shown[0].item.type)}. Buiten het
            verzendvenster worden ze ingepland. Dit kun je niet ongedaan maken.
          </p>
          <div className="flex gap-2">
            <SecondaryButton
              onClick={() => {
                const ids = shown.map((c) => c.item.id);
                setBulkOpen(false);
                ids.forEach(hide);
                act(() => bulkApprove(ids), () => showToast({ text: `${ids.length} verwerkt` }));
              }}
            >
              Ja, verzend {shown.length}
            </SecondaryButton>
            <TextButton onClick={() => setBulkOpen(false)}>Annuleer</TextButton>
          </div>
        </Sheet>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
          <div className="flex min-h-11 max-w-md items-center gap-4 rounded-[12px] bg-ink px-4 py-2 text-bg">
            <span>{toast.text}</span>
            {toast.undoId && (
              <button className="min-h-11 font-semibold underline" onClick={() => undo(toast.undoId!)}>
                Ongedaan maken
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CardBody({ card }: { card: CardData }) {
  const { item } = card;
  return (
    <article className="flex flex-col gap-4 rounded-[16px] border border-line bg-bg p-5">
      <div data-swipe-handle className="flex flex-col gap-1">
        <div className="t-meta flex items-center gap-2">
          <ChannelIcon channel={item.channel} />
          <span>
            {channelLabel(item.channel)} · {typeLabel(item.type)} · {item.recipient}
          </span>
        </div>
        <p className="t-meta">{item.reason}</p>
        {item.value_hint && <p className="t-meta">{item.value_hint}</p>}
      </div>
      <h2 className="t-card">{item.title}</h2>
      <ItemPreview item={item} slides={card.slides} />
    </article>
  );
}

function SwipeCard(props: { card: CardData; children: React.ReactNode; onRight: () => void; onLeft: () => void; onUp: () => void }) {
  const [d, setD] = useState({ x: 0, y: 0 });
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const start = useRef<{ x: number; y: number; id: number; fromHandle: boolean } | null>(null);
  const THRESHOLD = 110;

  function onDown(e: React.PointerEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("[data-noswipe],textarea,input,a,button")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, fromHandle: Boolean(t.closest("[data-swipe-handle]")) };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    setD({ x: dx, y: start.current.fromHandle ? Math.min(0, dy) : 0 });
  }
  function onUp() {
    if (!start.current) return;
    const { x, y } = d;
    start.current = null;
    if (x > THRESHOLD) {
      setLeaving("right");
      setTimeout(props.onRight, 160);
    } else if (x < -THRESHOLD) {
      setD({ x: 0, y: 0 });
      props.onLeft();
    } else if (y < -THRESHOLD && Math.abs(x) < 60) {
      setD({ x: 0, y: 0 });
      props.onUp();
    } else setD({ x: 0, y: 0 });
  }

  const x = leaving === "right" ? 600 : d.x;
  const rot = x / 30;
  return (
    <div
      className="relative touch-pan-y select-none"
      style={{
        transform: `translate(${x}px, ${d.y}px) rotate(${rot}deg)`,
        transition: start.current ? "none" : "transform 180ms cubic-bezier(.2,.9,.3,1.2)",
        opacity: leaving ? 0 : 1,
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        start.current = null;
        setD({ x: 0, y: 0 });
      }}
    >
      {props.children}
    </div>
  );
}

function EditSheet(props: { card: CardData; pending: boolean; onCancel: () => void; onSave: (body: string, firstComment?: string) => void }) {
  const [body, setBody] = useState(props.card.item.body);
  const [fc, setFc] = useState(props.card.item.payload.first_comment ?? "");
  return (
    <Sheet title="Bewerk" onClose={props.onCancel}>
      <label className="t-meta" htmlFor="edit-body">Tekst</label>
      <textarea id="edit-body" value={body} onChange={(e) => setBody(e.target.value)} rows={12}
        className="mt-1 w-full rounded-[12px] border border-line bg-bg p-3 outline-none focus:border-ink" />
      {props.card.item.payload.first_comment !== undefined && (
        <>
          <label className="t-meta mt-3 block" htmlFor="edit-fc">Eerste comment</label>
          <textarea id="edit-fc" value={fc} onChange={(e) => setFc(e.target.value)} rows={3}
            className="mt-1 w-full rounded-[12px] border border-line bg-bg p-3 outline-none focus:border-ink" />
        </>
      )}
      <div className="mt-3 flex gap-2">
        <SecondaryButton disabled={props.pending} onClick={() => props.onSave(body, fc || undefined)}>Opslaan</SecondaryButton>
        <TextButton onClick={props.onCancel}>Annuleer</TextButton>
      </div>
    </Sheet>
  );
}

function RewriteSheet(props: { pending: boolean; onCancel: () => void; onSubmit: (instruction: string) => void }) {
  const [v, setV] = useState("");
  return (
    <Sheet title="Herschrijf" onClose={props.onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) props.onSubmit(v.trim());
        }}
        className="flex flex-col gap-3"
      >
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="korter, minder salesy"
          className="h-12 rounded-[12px] border border-line bg-bg px-4 outline-none focus:border-ink" />
        <div className="flex flex-wrap gap-2">
          {["korter", "minder salesy", "persoonlijker", "sterkere hook"].map((s) => (
            <Chip key={s} onClick={() => setV(s)}>{s}</Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <SecondaryButton type="submit" disabled={props.pending || !v.trim()}>{props.pending ? "Bezig…" : "Herschrijf"}</SecondaryButton>
          <TextButton onClick={props.onCancel}>Annuleer</TextButton>
        </div>
      </form>
    </Sheet>
  );
}

function Empty() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-center">
      <Rocket size={28} strokeWidth={1.5} aria-hidden />
      <p className="t-card">Vlucht voltooid. Tot morgen.</p>
    </div>
  );
}
