"use client";

import { X } from "lucide-react";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** De enige roze knop op een scherm. */
export function PrimaryButton({ className = "", ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={`h-14 w-full rounded-[12px] bg-accent text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.99] disabled:opacity-40 ${className}`}
    />
  );
}

export function SecondaryButton({ className = "", type = "button", ...p }: BtnProps) {
  return (
    <button
      type={type}
      {...p}
      className={`min-h-12 rounded-[12px] bg-ink px-5 font-semibold text-bg transition-opacity duration-150 disabled:opacity-40 ${className}`}
    />
  );
}

export function TextButton({ className = "", type = "button", ...p }: BtnProps) {
  return <button type={type} {...p} className={`min-h-11 min-w-11 px-2 font-medium text-ink disabled:opacity-40 ${className}`} />;
}

export function Chip({ active, className = "", type = "button", ...p }: BtnProps & { active?: boolean }) {
  return (
    <button
      type={type}
      {...p}
      aria-pressed={active}
      className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] font-medium transition-colors duration-150 ${active ? "bg-ink text-bg" : "bg-surface text-ink"} ${className}`}
    />
  );
}

export function Sheet(props: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] bg-surface p-4" aria-label={props.title}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{props.title}</h3>
        <button onClick={props.onClose} aria-label="Sluiten" className="flex h-11 w-11 items-center justify-center">
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>
      {props.children}
    </section>
  );
}

export function StatusPill({ tone, children }: { tone: "ok" | "wait" | "plain"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-ok text-ok-ink" : tone === "wait" ? "bg-wait text-wait-ink" : "bg-surface text-muted";
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium ${cls}`}>{children}</span>;
}
