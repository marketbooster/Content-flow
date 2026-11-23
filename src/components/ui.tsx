import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatNL, relativeNL } from "../domain/dates";
import { RELIABILITY_LABELS } from "../domain/occurrences";
import { PILLAR_SHORT } from "../domain/profile";
import type { ContentFormat, IdeaTemplate, ISODate, PillarId, Reliability } from "../domain/types";

export function PageHeader({ kicker, title, sub, action }: { kicker?: string; title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        {kicker && <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">{kicker}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

type Tone = "neutral" | "accent" | "plum" | "ok" | "warn";
const TONES: Record<Tone, string> = {
  neutral: "bg-paper text-muted border-line",
  accent: "bg-accent-soft text-accent border-transparent",
  plum: "bg-plum-soft text-plum border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
};
export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function ReliabilityBadge({ r }: { r: Reliability }) {
  const tone: Tone = r === "betrouwbaar" ? "ok" : r === "berekend" ? "plum" : "warn";
  const title =
    r === "betrouwbaar" ? "Vaste datum of handmatig geverifieerd"
    : r === "berekend" ? "Jaarlijks berekend met een vaste rekenregel"
    : r === "te_verifieren" ? "Datum nog niet geverifieerd bij de bron"
    : "Niet meer actueel";
  return <Badge tone={tone} title={title}>{RELIABILITY_LABELS[r]}</Badge>;
}

export function PillarChip({ id }: { id: PillarId }) {
  return <Badge tone="plum">{PILLAR_SHORT[id]}</Badge>;
}

const FORMAT_LABEL: Record<ContentFormat, string> = {
  reel: "Reel", tiktok: "TikTok", carrousel: "Carrousel", story: "Story", post: "Post", live: "Live", blog: "Blog",
};
export const formatLabel = (f: ContentFormat) => FORMAT_LABEL[f];

export function RelevanceMeter({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted tabular" title={`${score}% relevant voor jou`}>
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-line">
        <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${score}%` }} />
      </span>
      {score}%
    </span>
  );
}

export function Button({
  children, onClick, variant = "primary", type = "button", disabled, className = "", title,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit"; disabled?: boolean; className?: string; title?: string;
}) {
  const v = {
    primary: "bg-accent text-white hover:opacity-90",
    secondary: "border border-line bg-card hover:bg-paper",
    ghost: "text-muted hover:text-ink",
    danger: "text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${v} ${className}`}>
      {children}
    </button>
  );
}

/** Bevestiging in de pagina zelf (geen browser-pop-up). */
export function ConfirmButton({ children, question, onConfirm, className = "" }: { children: ReactNode; question: string; onConfirm: () => void; className?: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button variant="danger" className={className} onClick={() => setAsking(true)}>{children}</Button>;
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 text-sm ${className}`}>
      <span>{question}</span>
      <Button variant="danger" onClick={() => { setAsking(false); onConfirm(); }}>Ja, verwijder</Button>
      <Button variant="ghost" onClick={() => setAsking(false)}>Annuleer</Button>
    </span>
  );
}

export function LinkButton({ to, children, variant = "secondary" }: { to: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const v = variant === "primary" ? "bg-accent text-white" : "border border-line bg-card hover:bg-paper";
  return <Link to={to} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${v}`}>{children}</Link>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function IdeaCardBody({ t, publishDate, today, eventName }: { t: IdeaTemplate; publishDate: ISODate; today: ISODate; eventName?: string }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{formatLabel(t.format)}</Badge>
        <PillarChip id={t.pillar} />
        {eventName && <Badge>{eventName}</Badge>}
      </div>
      <h3 className="mt-3 text-xl font-semibold leading-snug">{t.title}</h3>
      <p className="mt-2 text-[15px] italic text-plum">“{t.hook}”</p>
      <p className="mt-3 text-sm text-muted">{t.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-paper p-2">
          <dt className="text-muted">Ideaal publiceren</dt>
          <dd className="font-medium">{formatNL(publishDate, { weekday: true })} · {relativeNL(today, publishDate)}</dd>
        </div>
        <div className="rounded-lg bg-paper p-2">
          <dt className="text-muted">Productietijd</dt>
          <dd className="font-medium tabular">± {t.productionMinutes} min</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.needsNutritionCalc && <Badge tone="warn" title="Calorie-doelen zijn doelen; bereken voedingswaarden uit de echte ingrediënten vóór publicatie.">Voedingswaarden nog berekenen</Badge>}
        {t.commercial && <Badge tone="warn" title="Controleer briefing, exclusiviteit en reclame-labeling.">Commercieel: check voorwaarden</Badge>}
        {publishDate < today && <Badge tone="warn">Ideale datum is voorbij</Badge>}
      </div>
    </>
  );
}

/** Swipe-kaartjesstapel: sleep of gebruik de knoppen/pijltjestoetsen. */
export function SwipeDeck<T extends { key: string }>({
  items, render, onKeep, onSkip, emptyText,
}: {
  items: T[]; render: (item: T) => ReactNode; onKeep: (item: T) => void; onSkip: (item: T) => void; emptyText: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const top = items[0];
  if (!top) return <Empty>{emptyText}</Empty>;
  const commit = (dir: "keep" | "skip") => {
    setDx(0);
    if (dir === "keep") onKeep(top);
    else onSkip(top);
  };
  return (
    <div
      className="select-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") commit("keep");
        if (e.key === "ArrowLeft") commit("skip");
      }}
      aria-label="Ideeën swipen: pijl rechts = bewaren, pijl links = overslaan"
    >
      <div className="relative">
        {items[1] && <div aria-hidden className="absolute inset-x-3 -bottom-2 h-full rounded-3xl border border-line bg-card/70" />}
        <article
          key={top.key}
          className="relative rounded-3xl border border-line bg-card p-5 shadow-sm touch-pan-y"
          style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: start.current === null ? "transform .2s" : "none" }}
          onPointerDown={(e) => { start.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
          onPointerUp={() => {
            const d = dx;
            start.current = null;
            if (d > 110) commit("keep");
            else if (d < -110) commit("skip");
            else setDx(0);
          }}
        >
          {dx > 40 && <div className="absolute right-5 top-5 rounded-lg border-2 border-ok px-2 text-sm font-bold text-ok">BEWAREN</div>}
          {dx < -40 && <div className="absolute left-5 top-5 rounded-lg border-2 border-muted px-2 text-sm font-bold text-muted">OVERSLAAN</div>}
          {render(top)}
        </article>
      </div>
      <div className="mt-5 flex items-center justify-center gap-4">
        <button onClick={() => commit("skip")} aria-label="Overslaan" className="grid size-14 place-items-center rounded-full border border-line bg-card text-2xl text-muted shadow-sm hover:text-ink">✕</button>
        <span className="text-xs text-muted tabular">{items.length} over</span>
        <button onClick={() => commit("keep")} aria-label="Bewaren" className="grid size-14 place-items-center rounded-full bg-accent text-2xl text-white shadow-sm hover:opacity-90">♥</button>
      </div>
    </div>
  );
}
