import Link from "next/link";
import type { InboxItem } from "@/lib/types";

/** Het concept precies zoals het verstuurd wordt. */
export function ItemPreview({ item, slides }: { item: InboxItem; slides: string[] }) {
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

      {(item.payload.versions?.length ?? 0) > 0 && (
        <p className="t-meta">Versie {(item.payload.versions?.length ?? 0) + 1}</p>
      )}
    </div>
  );
}
