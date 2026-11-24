import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, X } from "lucide-react";
import type { InboxItem } from "@/lib/types";

type Seo = { score: number; checks: { id: string; label: string; ok: boolean; detail?: string }[] } | null;

/** Het concept precies zoals het verstuurd of gepubliceerd wordt. */
export function ItemPreview({ item, slides, seo = null }: { item: InboxItem; slides: string[]; seo?: Seo }) {
  if (item.payload.blog) return <BlogPreview item={item} seo={seo} />;
  if (item.payload.brief) return <BriefPreview item={item} />;
  return (
    <div className="flex flex-col gap-4">
      {slides.length > 0 && (
        <div data-noswipe className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1" aria-label="Slides">
          {slides.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={item.payload.slides?.[i] ? `${item.payload.slides[i].title}. ${item.payload.slides[i].body}` : item.title}
              width={1080}
              height={1350}
              loading={i < 2 ? "eager" : "lazy"}
              className="w-[78%] shrink-0 snap-center rounded-[12px] border border-line bg-surface"
            />
          ))}
        </div>
      )}

      {item.payload.email && (
        <p className="t-meta">
          Aan: {item.payload.email.to || "—"} · Onderwerp: {item.payload.email.subject}
        </p>
      )}

      <p className="whitespace-pre-wrap">{item.body}</p>

      {item.payload.hashtags?.length && !item.body.includes("#") ? (
        <p className="t-meta">{item.payload.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</p>
      ) : null}

      {item.payload.first_comment && (
        <div className="rounded-[12px] bg-surface p-3">
          <p className="t-meta mb-1">Eerste comment</p>
          <p className="whitespace-pre-wrap">{item.payload.first_comment}</p>
        </div>
      )}

      {item.payload.reel && (
        <div className="flex flex-col gap-3 rounded-[12px] bg-surface p-3">
          <div className="flex items-center justify-between">
            <p className="t-meta">Reel-script</p>
            <Link href={`/teleprompter/${item.id}`} className="min-h-11 content-center font-medium underline">
              Teleprompter
            </Link>
          </div>
          <p className="font-semibold">{item.payload.reel.hook}</p>
          <ol className="flex flex-col gap-2">
            {item.payload.reel.shots.map((s, i) => (
              <li key={i}>
                <span className="t-meta">Shot {i + 1} · {s.visual}</span>
                <br />
                {s.voiceover}
              </li>
            ))}
          </ol>
          <p className="t-meta">CTA: {item.payload.reel.cta}</p>
        </div>
      )}

      {(item.payload.versions?.length ?? 0) > 0 && <p className="t-meta">Versie {(item.payload.versions?.length ?? 0) + 1}</p>}
    </div>
  );
}

function BriefPreview({ item }: { item: InboxItem }) {
  const b = item.payload.brief!;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="t-meta">Zoekwoord</dt>
        <dd className="font-medium">{b.keyword}</dd>
        <dt className="t-meta">Intentie</dt>
        <dd>{b.intent}</dd>
      </dl>
      <div>
        <p className="t-meta mb-1">Opbouw</p>
        <ol className="list-decimal pl-5">
          {b.outline.map((h) => <li key={h}>{h}</li>)}
        </ol>
      </div>
      <div>
        <p className="t-meta mb-1">Vragen voor het FAQ-blok</p>
        <ul className="list-disc pl-5">{b.questions.map((q) => <li key={q}>{q}</li>)}</ul>
      </div>
      <div className="rounded-[12px] bg-surface p-3">
        <p className="t-meta mb-1">Wat er nu rankt</p>
        <p>{b.serp_notes}</p>
        <p className="t-meta mb-1 mt-3">Overlap met je bestaande blogs</p>
        <p>{b.cannibalization}</p>
      </div>
      <p className="t-meta">Interne links: {b.internal_links.map((l) => l.url).join(" · ")}</p>
    </div>
  );
}

function BlogPreview({ item, seo }: { item: InboxItem; seo: Seo }) {
  const b = item.payload.blog!;
  const failed = seo?.checks.filter((c) => !c.ok) ?? [];
  return (
    <div className="flex flex-col gap-5">
      {/* Zo verschijnt hij in Google */}
      <div className="rounded-[12px] bg-surface p-4">
        <p className="t-meta mb-2">Zo ziet Google hem</p>
        <p className="text-[13px] text-muted">marketbooster.nl › blog › {b.slug}</p>
        <p className="text-[18px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{b.seo_title}, Marketbooster</p>
        <p className="text-[14px] text-muted">{b.seo_description}</p>
      </div>

      {seo && (
        <details className="rounded-[12px] bg-surface p-4" open={failed.length > 0}>
          <summary className="flex min-h-11 cursor-pointer items-center justify-between font-medium">
            <span>SEO- en AI-check</span>
            <span className="t-num">{seo.score}/100</span>
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {seo.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[15px]">
                {c.ok ? <Check size={16} strokeWidth={1.5} className="mt-1 shrink-0" aria-label="ok" /> : <X size={16} strokeWidth={1.5} className="mt-1 shrink-0" aria-label="niet ok" />}
                <span className={c.ok ? "text-muted" : ""}>
                  {c.label}
                  {c.detail ? <span className="t-num"> · {c.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {failed.length > 0 && <p className="t-meta mt-3">Tip: Herschrijf met &quot;los de SEO-punten op&quot;.</p>}
        </details>
      )}

      <details className="rounded-[12px] border border-line p-4">
        <summary className="min-h-11 cursor-pointer content-center font-medium">Lees de hele blog</summary>
        <div className="blog-md mt-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.markdown}</ReactMarkdown>
        </div>
      </details>

      {item.payload.repurpose && (
        <p className="t-meta">Na publiceren komen er automatisch een LinkedIn-post en een carrousel over deze blog in je swipe-stapel.</p>
      )}
    </div>
  );
}
