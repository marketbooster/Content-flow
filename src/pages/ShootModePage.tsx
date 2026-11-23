// Opnamemodus: de briefing per shot schermvullend en groot, zodat je hem tijdens het filmen
// naast je camera kunt neerzetten. Scherm blijft aan; tik rechts = volgende, links = vorige.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { shootSlides } from "../domain/briefing";
import type { ContentItem } from "../domain/types";
import { useStore } from "../state/store";

const SIZES = [1.6, 2, 2.5, 3.1, 3.8]; // rem voor de shottitel

function useWakeLock() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (!wl || document.visibilityState !== "visible") return;
        lock = await wl.request("screen");
        if (!cancelled) setActive(true);
      } catch {
        setActive(false); // niet ondersteund of geweigerd: geen probleem
      }
    };
    request();
    const onVis = () => { if (document.visibilityState === "visible") request(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); lock?.release().catch(() => {}); };
  }, []);
  return active;
}

export default function ShootModePage() {
  const s = useStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const wake = useWakeLock();

  const items: ContentItem[] = useMemo(() => {
    const dayId = params.get("dag");
    const contentId = params.get("content");
    const ids = dayId ? s.shootDays.find((d) => d.id === dayId)?.contentIds ?? [] : contentId ? [contentId] : [];
    return ids.map((id) => s.content.find((c) => c.id === id)).filter((c): c is ContentItem => Boolean(c));
  }, [params, s.shootDays, s.content]);
  const slides = useMemo(() => shootSlides(items), [items]);

  const storageKey = `contentflow:opname:${params.toString()}`;
  const [i, setI] = useState(() => {
    try { return Math.min(Number(sessionStorage.getItem(storageKey)) || 0, Math.max(0, slides.length - 1)); } catch { return 0; }
  });
  const [size, setSize] = useState(() => { try { return Number(localStorage.getItem("contentflow:opname:size")) || 2; } catch { return 2; } });
  const [done, setDone] = useState<Set<string>>(new Set());
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"none" | "info" | "image">("none");

  useEffect(() => { try { sessionStorage.setItem(storageKey, String(i)); } catch { /* geen opslag */ } }, [i, storageKey]);
  useEffect(() => { try { localStorage.setItem("contentflow:opname:size", String(size)); } catch { /* geen opslag */ } }, [size]);

  const go = useCallback((d: number) => { setPanel("none"); setI((x) => Math.max(0, Math.min(slides.length - 1, x + d))); }, [slides.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") navigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, navigate]);

  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#120a1f] p-6 text-center text-white">
        <div>
          <p className="text-lg">Geen shots gevonden voor de opnamemodus.</p>
          <button onClick={() => navigate(-1)} className="btn-gradient mt-4 rounded-full px-5 py-2 font-semibold">Terug</button>
        </div>
      </div>
    );
  }

  const slide = slides[Math.min(i, slides.length - 1)];
  const { item, shot } = slide;
  const b = item.briefing;
  const key = `${item.id}:${shot.id}`;
  const videoIndex = items.findIndex((x) => x.id === item.id);
  const lastShotOfVideo = slide.index === slide.total - 1;
  const titleSize = SIZES[size] ?? 2.5;

  const markShot = () => {
    setDone(new Set([...done, key]));
    if (lastShotOfVideo) {
      if (item.status === "idee" || item.status === "script") s.updateContent(item.id, { status: "gefilmd" });
    }
    if (i < slides.length - 1) go(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#120a1f] text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Bovenbalk */}
      <div className="flex items-center gap-2 px-4 py-2 text-sm">
        <button onClick={() => navigate(-1)} aria-label="Opnamemodus sluiten" className="grid size-10 place-items-center rounded-full bg-white/10 text-lg">✕</button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{item.title}</div>
          <div className="text-xs text-white/60">
            {items.length > 1 && <>Video {videoIndex + 1}/{items.length} · </>}Shot {slide.index + 1}/{slide.total}
            {wake && <> · scherm blijft aan</>}
          </div>
        </div>
        <button onClick={() => setSize(Math.max(0, size - 1))} aria-label="Kleinere tekst" className="grid size-10 place-items-center rounded-full bg-white/10 text-sm font-bold">A−</button>
        <button onClick={() => setSize(Math.min(SIZES.length - 1, size + 1))} aria-label="Grotere tekst" className="grid size-10 place-items-center rounded-full bg-white/10 text-lg font-bold">A+</button>
      </div>

      {/* Voortgang */}
      <div className="flex gap-1 px-4" aria-hidden>
        {slides.map((sl, j) => (
          <span key={j} className={`h-1 flex-1 rounded-full ${j === i ? "bg-[#fde68a]" : done.has(`${sl.item.id}:${sl.shot.id}`) ? "bg-[#a78bfa]" : "bg-white/15"}`} />
        ))}
      </div>

      {/* Inhoud: tik links/rechts om te bladeren */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-10">
        <button aria-label="Vorig shot" onClick={() => go(-1)} className="absolute inset-y-0 left-0 z-0 w-1/4" />
        <button aria-label="Volgend shot" onClick={() => go(1)} className="absolute inset-y-0 right-0 z-0 w-1/4" />
        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="font-display text-[#fde68a]" style={{ fontSize: `${titleSize * 0.6}rem` }}>Shot {slide.index + 1}</div>
          <h1 className="font-display leading-tight" style={{ fontSize: `${titleSize}rem` }}>{shot.title}</h1>

          {shot.say && (
            <p className="mt-5 rounded-2xl bg-white/10 p-4 italic leading-snug" style={{ fontSize: `${titleSize * 0.7}rem` }}>“{shot.say}”</p>
          )}

          {shot.mustInclude.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#f9a8d4]">Moet erin</div>
              <ul className="space-y-2">
                {shot.mustInclude.map((m, j) => {
                  const k = `${key}:${j}`;
                  return (
                    <li key={k}>
                      <label className="flex items-center gap-3 rounded-2xl bg-white/5 p-3" style={{ fontSize: `${titleSize * 0.55}rem` }}>
                        <input type="checkbox" className="size-7 shrink-0 accent-[#a78bfa]" checked={ticks.has(k)}
                          onChange={(e) => { const n = new Set(ticks); e.target.checked ? n.add(k) : n.delete(k); setTicks(n); }} />
                        <span className={ticks.has(k) ? "text-white/50 line-through" : ""}>{m}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {shot.notes && <p className="mt-4 text-white/70" style={{ fontSize: `${titleSize * 0.45}rem` }}>{shot.notes}</p>}

          {b && b.alwaysInclude.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {b.alwaysInclude.map((x, j) => <span key={j} className="rounded-full bg-[#fde68a] px-3 py-1 text-sm font-bold text-[#1a0e2e]">{x}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Extra panelen */}
      {panel === "info" && b && (
        <div className="max-h-[45%] overflow-y-auto border-t border-white/10 bg-[#1d1330] px-5 py-4 text-base">
          {b.dos.length > 0 && <><b className="text-[#86efac]">Do's</b><ul className="mb-3 list-disc pl-5">{b.dos.map((x, j) => <li key={j}>{x}</li>)}</ul></>}
          {b.donts.length > 0 && <><b className="text-[#fca5a5]">Don'ts</b><ul className="mb-3 list-disc pl-5">{b.donts.map((x, j) => <li key={j}>{x}</li>)}</ul></>}
          {item.hook && <p><b>Hook:</b> {item.hook}</p>}
          {b.text && <details className="mt-2"><summary className="cursor-pointer text-white/70">Volledige briefingtekst</summary><p className="mt-2 whitespace-pre-wrap text-white/80">{b.text}</p></details>}
        </div>
      )}
      {panel === "image" && b && b.images.length > 0 && (
        <div className="absolute inset-0 z-20 overflow-auto bg-black" onClick={() => setPanel("none")}>
          <div className="sticky top-0 p-3 text-right"><span className="rounded-full bg-white/15 px-3 py-1 text-sm">Tik om te sluiten</span></div>
          {b.images.map((src, j) => <img key={j} src={src} alt={`Briefing ${j + 1}`} className="mx-auto mb-4 w-full max-w-3xl" />)}
        </div>
      )}

      {/* Onderbalk */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="Vorige" className="grid size-14 place-items-center rounded-full bg-white/10 text-2xl">←</button>
        {b && (b.dos.length > 0 || b.donts.length > 0 || b.text) && (
          <button onClick={() => setPanel(panel === "info" ? "none" : "info")} className="grid size-14 place-items-center rounded-full bg-white/10 text-sm font-semibold" aria-label="Do's, don'ts en briefing">info</button>
        )}
        {b && b.images.length > 0 && (
          <button onClick={() => setPanel("image")} className="grid size-14 place-items-center rounded-full bg-white/10 text-xl" aria-label="Briefing-afbeelding tonen">📄</button>
        )}
        <button onClick={markShot} className="btn-gradient h-14 flex-1 rounded-full text-lg font-semibold">
          {done.has(key) ? "✓ Gefilmd" : lastShotOfVideo ? "✓ Video klaar" : "✓ Shot klaar"}
        </button>
        <button onClick={() => go(1)} disabled={i === slides.length - 1} aria-label="Volgende" className="grid size-14 place-items-center rounded-full bg-white/10 text-2xl">→</button>
      </div>
    </div>
  );
}
