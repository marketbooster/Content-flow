"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { CalendarEntry, ContentIdea } from "@/lib/types";
import { REJECT_REASONS } from "@/lib/types";
import { moveCalendarEntry, retryProduce, runAgentNow, swipeIdea } from "@/app/actions";
import { ChannelIcon, channelLabel } from "./channel";
import { Chip, Sheet, StatusPill, TextButton, SecondaryButton } from "./ui";
import { dayKey, formatDay, formatDayTime, formatTime } from "@/lib/time";

const FORMAT: Record<ContentIdea["format"], string> = { post: "Post", carousel: "Carrousel", reel: "Reel" };
const IDEA_REASONS = ["niet relevant", "verkeerde toon", "al eerder gedaan", "past niet bij pijler"];

export function CalendarClient(props: {
  ideas: ContentIdea[];
  entries: CalendarEntry[];
  days: string[];
  offset: number;
  emptySlots: { channel: "linkedin" | "instagram"; at: string; onlyFormat?: string }[];
  warnings: string[];
}) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ideas = props.ideas.filter((i) => !gone.has(i.id));
  const idea = ideas[0];

  function swipe(dir: "right" | "left" | "up", reason?: string) {
    if (!idea) return;
    const id = idea.id;
    setGone((g) => new Set(g).add(id));
    setRejecting(false);
    start(async () => {
      const res = await swipeIdea(id, dir, reason);
      if (!res.ok) {
        setMsg(res.error);
        setGone((g) => {
          const n = new Set(g);
          n.delete(id);
          return n;
        });
        return;
      }
      if (res.data?.slot) setMsg(dir === "up" ? `Creator maakt hem nu · ${formatDayTime(res.data.slot)}` : `Ingepland · ${formatDayTime(res.data.slot)}`);
      else setMsg(null);
      router.refresh();
    });
  }

  function runCreator() {
    start(async () => {
      setMsg("Creator bedenkt 10 ideeën…");
      const res = await runAgentNow("creator");
      setMsg(res.ok ? "10 nieuwe ideeën" : res.error);
      router.refresh();
    });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));
  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const entry = props.entries.find((x) => x.id === e.active.id);
    const day = String(e.over.id);
    if (!entry || dayKey(new Date(entry.slot_at)) === dayKey(new Date(day))) return;
    start(async () => {
      const res = await moveCalendarEntry(entry.id, day);
      setMsg(res.ok ? `Verplaatst naar ${formatDay(day)}` : res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8 pt-2">
      <section className="flex flex-col gap-4" aria-label="Swipe-stapel">
        <div className="flex items-baseline justify-between">
          <h1 className="t-title">Kalender</h1>
          <span className="t-meta"><span className="t-num">{ideas.length}</span> ideeën</span>
        </div>

        {idea ? (
          <>
            <IdeaCard key={idea.id} idea={idea} onSwipe={(d) => (d === "left" ? setRejecting(true) : swipe(d))} />
            {rejecting ? (
              <Sheet title="Waarom weg?" onClose={() => setRejecting(false)}>
                <div className="flex flex-wrap gap-2">
                  {[...new Set([...IDEA_REASONS, REJECT_REASONS[1]])].map((r) => (
                    <Chip key={r} onClick={() => swipe("left", r)}>{r}</Chip>
                  ))}
                </div>
              </Sheet>
            ) : (
              <div className="flex justify-between">
                <TextButton onClick={() => setRejecting(true)}>Weg</TextButton>
                <TextButton onClick={() => swipe("up")} disabled={pending}>Vandaag maken</TextButton>
                <SecondaryButton onClick={() => swipe("right")} disabled={pending}>In de kalender</SecondaryButton>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-[16px] bg-surface p-5">
            <p>Geen ideeën meer in de stapel.</p>
            <SecondaryButton onClick={runCreator} disabled={pending}>{pending ? "Bezig…" : "Creator: 10 nieuwe ideeën"}</SecondaryButton>
          </div>
        )}
        {msg && <p className="t-meta" role="status">{msg}</p>}
      </section>

      <section className="flex flex-col gap-3" aria-label="Week">
        <div className="flex items-center justify-between">
          <Link href={`/kalender?w=${props.offset - 1}`} aria-label="Vorige week" className="flex h-11 w-11 items-center justify-center">
            <ChevronLeft size={20} strokeWidth={1.5} />
          </Link>
          <h2 className="font-semibold">
            {props.offset === 0 ? "Deze week" : props.offset === 1 ? "Volgende week" : `${formatDay(props.days[0])} – ${formatDay(props.days[6])}`}
          </h2>
          <Link href={`/kalender?w=${props.offset + 1}`} aria-label="Volgende week" className="flex h-11 w-11 items-center justify-center">
            <ChevronRight size={20} strokeWidth={1.5} />
          </Link>
        </div>
        {props.warnings.length > 0 && <p className="t-meta">{props.warnings.join(" · ")}</p>}

        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <ol className="flex flex-col gap-2">
            {props.days.map((day) => (
              <DayRow
                key={day}
                day={day}
                entries={props.entries.filter((e) => dayKey(new Date(e.slot_at)) === dayKey(new Date(day)))}
                empty={props.emptySlots.filter((s) => dayKey(new Date(s.at)) === dayKey(new Date(day)))}
                onRetry={(id) => start(async () => {
                  const res = await retryProduce(id);
                  setMsg(res.ok ? "Opnieuw gemaakt" : res.error);
                  router.refresh();
                })}
              />
            ))}
          </ol>
        </DndContext>
        <p className="t-meta">Houd een post vast en sleep hem naar een andere dag. Roze vakjes zijn lege slots.</p>
      </section>
    </div>
  );
}

function IdeaCard({ idea, onSwipe }: { idea: ContentIdea; onSwipe: (d: "right" | "left" | "up") => void }) {
  const [d, setD] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <article
      className="flex min-h-48 touch-none select-none flex-col justify-between gap-4 rounded-[16px] border border-line bg-bg p-5"
      style={{ transform: `translate(${d.x}px, ${Math.min(0, d.y)}px) rotate(${d.x / 30}deg)`, transition: start.current ? "none" : "transform 180ms cubic-bezier(.2,.9,.3,1.2)" }}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => start.current && setD({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })}
      onPointerUp={() => {
        start.current = null;
        const { x, y } = d;
        setD({ x: 0, y: 0 });
        if (x > 110) onSwipe("right");
        else if (x < -110) onSwipe("left");
        else if (y < -110 && Math.abs(x) < 60) onSwipe("up");
      }}
      onPointerCancel={() => {
        start.current = null;
        setD({ x: 0, y: 0 });
      }}
    >
      <div className="t-meta flex items-center gap-2">
        <ChannelIcon channel={idea.channel} />
        {channelLabel(idea.channel)} · {FORMAT[idea.format]} · {idea.pillar}
      </div>
      <h2 className="t-card">{idea.hook}</h2>
      <p className="text-muted">{idea.angle}</p>
    </article>
  );
}

function DayRow(props: {
  day: string;
  entries: CalendarEntry[];
  empty: { channel: "linkedin" | "instagram"; at: string; onlyFormat?: string }[];
  onRetry: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.day });
  const today = dayKey(new Date()) === dayKey(new Date(props.day));
  return (
    <li ref={setNodeRef} className={`flex gap-3 rounded-[16px] p-3 transition-colors duration-150 ${isOver ? "bg-surface" : ""}`}>
      <div className={`w-16 shrink-0 pt-1 text-[13px] font-medium ${today ? "text-ink" : "text-muted"}`}>{formatDay(props.day).replace(".", "")}</div>
      <div className="flex min-h-11 min-w-0 flex-1 flex-col gap-2">
        {props.entries.map((e) => (
          <EntryChip key={e.id} entry={e} onRetry={props.onRetry} />
        ))}
        {props.empty.map((s) => (
          <div key={`${s.channel}${s.at}`} className="t-meta flex min-h-11 items-center gap-2 rounded-[12px] border border-dashed border-accent/40 bg-slot px-3">
            <ChannelIcon channel={s.channel} />
            {formatTime(s.at)} · leeg {s.onlyFormat === "reel" ? "Reel-slot" : "slot"}
          </div>
        ))}
      </div>
    </li>
  );
}

function EntryChip({ entry, onRetry }: { entry: CalendarEntry; onRetry: (id: string) => void }) {
  const draggable = entry.status !== "posted";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: entry.id, disabled: !draggable });
  const tone = entry.status === "posted" ? "ok" : entry.status === "ready" ? "plain" : "wait";
  const label = { planned: "wordt gemaakt", producing: "wordt gemaakt", ready: "klaar", posted: "geplaatst", failed: "mislukt" }[entry.status];
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, zIndex: isDragging ? 10 : undefined }}
      className={`flex min-h-11 items-center gap-2 rounded-[12px] bg-surface px-3 py-2 ${draggable ? "cursor-grab touch-none" : ""}`}
    >
      <ChannelIcon channel={entry.channel} />
      <span className="t-num text-[13px] text-muted">{formatTime(entry.slot_at)}</span>
      <span className="min-w-0 flex-1 truncate">{entry.hook}</span>
      {entry.status === "failed" ? (
        <button onClick={() => onRetry(entry.id)} onPointerDown={(e) => e.stopPropagation()} aria-label="Opnieuw maken" className="flex h-11 w-11 items-center justify-center">
          <RefreshCw size={16} strokeWidth={1.5} />
        </button>
      ) : (
        <StatusPill tone={tone}>{label}</StatusPill>
      )}
    </div>
  );
}
