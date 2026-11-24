import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import { InboxColumn } from "../components/InboxColumn";
import { Badge, PageHeader, PillarChip, formatLabel } from "../components/ui";
import { diffDays, formatNL } from "../domain/dates";
import { CONTENT_STATUSES, type ContentItem, type ContentStatus } from "../domain/types";
import { useStore } from "../state/store";

export default function BoardPage() {
  const s = useStore();
  const [active, setActive] = useState<ContentItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Op touch: even vasthouden voordat slepen start, zodat horizontaal scrollen blijft werken.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  // Gepubliceerde items na 14 dagen van het bord halen (blijven in de kalender).
  const visible = s.content.filter(
    (c) => c.status !== "gepubliceerd" || !c.date || diffDays(c.date, s.today) <= 14,
  );
  const byStatus = (st: ContentStatus) =>
    visible.filter((c) => c.status === st).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const to = e.over?.id as ContentStatus | undefined;
    if (to && e.active.id) s.updateContent(String(e.active.id), { status: to });
  };

  return (
    <>
      <PageHeader kicker="Productie" title="Productiebord" sub="Sleep kaarten naar de volgende stap. Op je telefoon: even vasthouden en dan slepen." />
      <DndContext sensors={sensors} onDragStart={(e) => setActive(s.content.find((c) => c.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] md:overflow-visible md:px-0">
          <InboxColumn />
          {CONTENT_STATUSES.map((col, i) => (
            <Column key={col.id} id={col.id} label={col.label} items={byStatus(col.id)} next={CONTENT_STATUSES[i + 1]?.id}
              onAdvance={(id, to) => s.updateContent(id, { status: to })} today={s.today} />
          ))}
        </div>
        <DragOverlay>{active ? <CardBody c={active} today={s.today} dragging /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

function Column({ id, label, items, next, onAdvance, today }: {
  id: ContentStatus; label: string; items: ContentItem[]; next?: ContentStatus;
  onAdvance: (id: string, to: ContentStatus) => void; today: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={label}
      className={`w-[78vw] max-w-xs shrink-0 snap-start rounded-2xl border p-2 md:w-auto md:max-w-none ${isOver ? "border-accent bg-accent-soft" : "border-line bg-card/60"}`}>
      <h2 className="flex items-center justify-between px-1 pb-2 font-sans text-sm font-semibold">
        {label} <span className="rounded-full bg-paper px-2 text-xs text-muted tabular">{items.length}</span>
      </h2>
      <ul className="flex min-h-24 flex-col gap-2">
        {items.map((c) => <DraggableCard key={c.id} c={c} next={next} onAdvance={onAdvance} today={today} />)}
        {items.length === 0 && <li className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">Sleep hierheen</li>}
      </ul>
    </section>
  );
}

function DraggableCard({ c, next, onAdvance, today }: { c: ContentItem; next?: ContentStatus; onAdvance: (id: string, to: ContentStatus) => void; today: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  return (
    <li ref={setNodeRef} {...attributes} {...listeners} className={`touch-manipulation ${isDragging ? "opacity-30" : ""}`}>
      <CardBody c={c} today={today}>
        {next && (
          <button onClick={() => onAdvance(c.id, next)} onPointerDown={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-accent" aria-label={`${c.title} naar ${next}`}>
            → {CONTENT_STATUSES.find((x) => x.id === next)?.label}
          </button>
        )}
      </CardBody>
    </li>
  );
}

function CardBody({ c, today, dragging, children }: { c: ContentItem; today: string; dragging?: boolean; children?: React.ReactNode }) {
  const days = c.date ? diffDays(today, c.date) : null;
  const urgent = days !== null && days <= 2 && c.status !== "bewerkt" && c.status !== "gepubliceerd";
  return (
    <div className={`rounded-xl border bg-card p-3 text-sm ${dragging ? "shadow-soft rotate-2 border-accent" : "border-line"}`}>
      <Link to={`/content/${c.id}`} onPointerDown={(e) => e.stopPropagation()} className="font-medium leading-snug hover:text-accent">{c.title}</Link>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge tone="accent">{formatLabel(c.format)}</Badge>
        <PillarChip id={c.pillar} />
        {c.dealId && <Badge tone="warn">Deal</Badge>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`text-xs tabular ${urgent ? "font-semibold text-warn" : "text-muted"}`}>
          {c.date ? `${formatNL(c.date)}${urgent ? " ⚠️" : ""}` : "Geen datum"}
        </span>
        {children}
      </div>
    </div>
  );
}
