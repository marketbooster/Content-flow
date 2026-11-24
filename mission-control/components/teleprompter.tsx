"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Pause, Play, Plus, X } from "lucide-react";

/** Teleprompter: grote tekst, scrolt vanzelf. Tik op het scherm om te pauzeren. */
export function Teleprompter({ title, lines, shots }: { title: string; lines: string[]; shots: string[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(40); // px per seconde
  const [size, setSize] = useState(40);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const el = ref.current;
      if (el) el.scrollTop += ((t - last) / 1000) * speed;
      last = t;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#151A28] text-white">
      <div className="flex items-center justify-between gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <button aria-label="Sluiten" onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center"><X size={22} strokeWidth={1.5} /></button>
        <span className="truncate text-[13px] font-medium opacity-70">{title}</span>
        <div className="flex">
          <button aria-label="Kleiner" onClick={() => setSize((s) => Math.max(24, s - 4))} className="flex h-11 w-11 items-center justify-center"><Minus size={20} strokeWidth={1.5} /></button>
          <button aria-label="Groter" onClick={() => setSize((s) => Math.min(72, s + 4))} className="flex h-11 w-11 items-center justify-center"><Plus size={20} strokeWidth={1.5} /></button>
        </div>
      </div>
      <div ref={ref} onClick={() => setRunning((r) => !r)} className="flex-1 overflow-y-auto px-6 py-[40vh]" style={{ fontSize: size, lineHeight: 1.35, fontWeight: 600 }}>
        {lines.map((l, i) => (
          <p key={i} className="mb-[1em]">
            {shots[i - 1] && <span className="mb-2 block text-[14px] font-medium opacity-50">Shot {i} · {shots[i - 1]}</span>}
            {l}
          </p>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button onClick={() => setSpeed((s) => Math.max(10, s - 10))} className="min-h-11 px-3 text-[15px] opacity-80">Langzamer</button>
        <button aria-label={running ? "Pauze" : "Start"} onClick={() => setRunning((r) => !r)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#151A28]">
          {running ? <Pause size={22} strokeWidth={1.5} /> : <Play size={22} strokeWidth={1.5} />}
        </button>
        <button onClick={() => setSpeed((s) => Math.min(140, s + 10))} className="min-h-11 px-3 text-[15px] opacity-80">Sneller</button>
      </div>
    </div>
  );
}
