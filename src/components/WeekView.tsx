// Weekweergave met slepen: verplaats content naar een andere dag (muis, touch of toetsenbord).
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, formatNL } from "../domain/dates";
import { relevanceFor } from "../domain/relevance";
import { CONTENT_STATUSES, type ContentItem, type EventType, type ISODate } from "../domain/types";
import { useStore } from "../state/store";
import { Badge, PillarChip, formatLabel } from "./ui";

const WD = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function WeekView({ monday, minRelevance, types }: { monday: ISODate; minRelevance: number; types: Set<EventType> }) {
  const s = useStore();
  const [active, setActive] = useState<ContentItem | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const byId = useMemo(() => new Map(s.events.map((e) => [e.id, e])), [s.events]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const day = e.over?.id as ISODate | undefined;
    if (day && e.active.id) s.updateContent(String(e.active.id), { date: day });
  };

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActive(s.content.find((c) => c.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <ol className="space-y-2">
        {days.map((d, i) => {
          const events = s.occurrences
            .filter((o) => o.start <= d && o.end >= d && (o.start === d || o.end <= addDays(o.start, 3)))
            .map((o) => ({ o, ev: byId.get(o.eventId)! }))
            .filter(({ ev }) => types.has(ev.type) && relevanceFor(ev, s.creator).score >= minRelevance);
          const items = s.content.filter((c) => c.date === d);
          const shoot = s.shootDays.find((x) => x.date === d);
          const deadlines = s.deals.filter((x) => x.contentDeadline === d && x.status !== "afgewezen");
          return (
            <DayRow key={d} day={d} label={WD[i]} isToday={d === s.today}>
              <div className="flex flex-wrap gap-1">
                {events.map(({ o, ev }) => (
                  <Link key={o.key} to={`/moment/${encodeURIComponent(o.key)}`} className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{ev.name}</Link>
                ))}
                {shoot && <Link to={`/opnamedag?dag=${shoot.id}`} className="tape">🎬 opnamedag</Link>}
                {deadlines.map((x) => <Link key={x.id} to="/deals" className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">⏰ {x.brand}</Link>)}
              </div>
              {items.length > 0 && <ul className="mt-1.5 space-y-1.5">{items.map((c) => <DraggableItem key={c.id} c={c} />)}</ul>}
            </DayRow>
          );
        })}
      </ol>
      <DragOverlay>{active ? <ItemBody c={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function DayRow({ day, label, isToday, children }: { day: ISODate; label: string; isToday: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  return (
    <li ref={setNodeRef} className={`flex gap-3 rounded-2xl border p-2.5 ${isOver ? "border-accent bg-accent-soft" : "border-line bg-card"}`}>
      <div className={`grid w-11 shrink-0 place-items-center rounded-xl py-1 text-center ${isToday ? "bg-brand" : "bg-paper"}`}>
        <span className="text-[10px] uppercase">{label}</span>
        <span className="font-display text-lg font-semibold leading-none tabular">{Number(day.slice(8))}</span>
      </div>
      <div className="min-w-0 flex-1 self-center">{children}</div>
    </li>
  );
}

function DraggableItem({ c }: { c: ContentItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  return (
    <li ref={setNodeRef} {...attributes} {...listeners} aria-label={`${c.title}, sleep naar een andere dag`} className={`touch-manipulation ${isDragging ? "opacity-30" : ""}`}>
      <ItemBody c={c} />
    </li>
  );
}

function ItemBody({ c, dragging }: { c: ContentItem; dragging?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm ${dragging ? "shadow-soft rotate-1 border-accent bg-card" : "border-line bg-paper"}`}>
      <span className="cursor-grab text-muted" aria-hidden>⋮⋮</span>
      <Link to={`/content/${c.id}`} onPointerDown={(e) => e.stopPropagation()} className="min-w-0 flex-1 truncate font-medium hover:text-accent">{c.title}</Link>
      <span className="hidden shrink-0 gap-1 sm:flex"><Badge tone="accent">{formatLabel(c.format)}</Badge><PillarChip id={c.pillar} /></span>
      <Badge>{CONTENT_STATUSES.find((x) => x.id === c.status)?.label}</Badge>
    </div>
  );
}

export function mondayOf(d: ISODate): ISODate {
  const wd = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(d, -wd);
}

export const weekLabel = (monday: ISODate) => `${formatNL(monday)} – ${formatNL(addDays(monday, 6))}`;
