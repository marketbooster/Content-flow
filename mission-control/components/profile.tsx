"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AgentName, AgentRun, Brain, Channel, DispatchLog, Settings, Suppression } from "@/lib/types";
import { addSuppression, runAgentNow, saveBrain, saveSettings } from "@/app/actions";
import { SecondaryButton, StatusPill, TextButton } from "./ui";
import { channelLabel } from "./channel";
import { formatDayTime } from "@/lib/time";

interface AgentRow {
  name: AgentName;
  title: string;
  job: string;
  schedule: string;
  sprint: number;
  built: boolean;
  cron: boolean;
  testedManually: boolean;
  last: AgentRun | null;
}

const euro = (n: number) => `€${n.toFixed(2).replace(".", ",")}`;

export function ProfileClient(props: {
  brain: Brain;
  settings: Settings;
  agents: AgentRow[];
  runs: AgentRun[];
  spent: number;
  budget: "ok" | "warn" | "stop";
  connections: { name: string; ok: boolean; detail: string }[];
  log: DispatchLog[];
  suppression: Suppression[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (success ?? null) : (res.error ?? "Er ging iets mis"));
      router.refresh();
    });
  }

  const s = props.settings;
  const pct = Math.min(100, (props.spent / Math.max(1, s.monthly_budget_eur)) * 100);

  return (
    <div className="flex flex-col gap-12 pt-2">
      <h1 className="t-title">Profiel</h1>
      {msg && <p className="rounded-[12px] bg-surface p-3" role="status">{msg}</p>}

      {/* Noodknop */}
      <section className="flex flex-col gap-3">
        <h2 className="t-card">Noodknop</h2>
        <p className="text-muted">{s.paused ? "Alle agents en verzendingen staan stil." : "Alles draait."}</p>
        <SecondaryButton disabled={pending} onClick={() => act(() => saveSettings({ paused: !s.paused }), s.paused ? "Hervat" : "Alles gepauzeerd")}>
          {s.paused ? "Hervat alles" : "Alles pauzeren"}
        </SecondaryButton>
      </section>

      {/* Kosten (dashboard-tegel) */}
      <section className="flex flex-col gap-3">
        <h2 className="t-card">Kosten deze maand</h2>
        <p>
          <span className="t-num text-[15px]">{euro(props.spent)}</span> <span className="t-meta">van {euro(s.monthly_budget_eur)} plafond</span>
          {props.budget !== "ok" && <StatusPill tone="wait">{props.budget === "stop" ? "gestopt" : "80% bereikt"}</StatusPill>}
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-surface"><div className="h-full bg-ink" style={{ width: `${pct}%` }} /></div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(new FormData(e.currentTarget).get("budget"));
            act(() => saveSettings({ monthly_budget_eur: v }), "Plafond opgeslagen");
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="t-meta">Maandplafond (€)</span>
            <input name="budget" type="number" min={0} step={5} defaultValue={s.monthly_budget_eur} className="t-num h-11 w-28 rounded-[12px] border border-line bg-bg px-3" />
          </label>
          <TextButton type="submit">Opslaan</TextButton>
        </form>
      </section>

      {/* Agents */}
      <section className="flex flex-col gap-3">
        <h2 className="t-card">Agents</h2>
        <p className="t-meta">Test een agent eerst met Run nu. Daarna kun je hem op het schema zetten.</p>
        <ul className="flex flex-col gap-2">
          {props.agents.map((a) => (
            <li key={a.name} className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{a.title}</span>
                <span className="t-meta">{a.schedule}</span>
              </div>
              <p className="t-meta">{a.job}</p>
              {a.built ? (
                <>
                  <p className="t-meta">
                    {a.last ? (
                      <>
                        Laatste run {formatDayTime(a.last.started_at)} · {a.last.status === "error" ? `fout: ${a.last.error}` : `${a.last.items_created} items`} ·{" "}
                        <span className="t-num">{euro(Number(a.last.cost_eur))}</span>
                      </>
                    ) : (
                      "Nog niet gedraaid"
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <TextButton disabled={pending} onClick={() => act(() => runAgentNow(a.name), `${a.title} klaar`)}>
                      {pending ? "Bezig…" : "Run nu"}
                    </TextButton>
                    <label className={`ml-auto flex min-h-11 items-center gap-2 ${a.testedManually ? "" : "opacity-40"}`}>
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-[var(--text)]"
                        checked={a.cron}
                        disabled={!a.testedManually || pending}
                        onChange={(e) => act(() => saveSettings({ cron_enabled: { ...s.cron_enabled, [a.name]: e.target.checked } }))}
                      />
                      Op schema
                    </label>
                  </div>
                </>
              ) : (
                <StatusPill tone="plain">Sprint {a.sprint}</StatusPill>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Merkbrein */}
      <section className="flex flex-col gap-3">
        <h2 className="t-card">Merkbrein</h2>
        <p className="t-meta">Alle agents lezen dit. Eén regel per item bij lijsten.</p>
        <form action={(fd) => act(() => saveBrain(fd), "Brein opgeslagen")} className="flex flex-col gap-4">
          <Field label="Toon" name="tone" value={props.brain.tone} rows={3} />
          <Field label="Ideale klant (ICP)" name="icp" value={props.brain.icp} rows={3} />
          <Field label="Pijlers" name="pillars" value={props.brain.pillars.join("\n")} rows={5} />
          <Field label="Aanbod en prijzen" name="prices" value={props.brain.prices} rows={3} />
          <Field label="Verboden woorden (komma's)" name="forbidden_words" value={props.brain.forbidden_words.join(", ")} rows={2} />
          <Field label="Wat werkte" name="what_worked" value={props.brain.what_worked} rows={3} />
          <Field label="Contentbank (open onderwerpen)" name="contentbank" value={props.brain.contentbank.join("\n")} rows={8} />
          <SecondaryButton type="submit" disabled={pending}>Opslaan</SecondaryButton>
        </form>
        {props.brain.learnings.length > 0 && (
          <details className="rounded-[16px] bg-surface p-4">
            <summary className="min-h-11 content-center font-medium">Learnings ({props.brain.learnings.length})</summary>
            <ul className="mt-2 flex flex-col gap-2">
              {[...props.brain.learnings].reverse().slice(0, 30).map((l, i) => (
                <li key={i} className="t-meta">{formatDayTime(l.at)} · {l.note}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Koppelingen */}
      <section id="koppelingen" className="flex flex-col gap-3">
        <h2 className="t-card">Koppelingen</h2>
        <ul className="flex flex-col gap-2">
          {props.connections.map((c) => (
            <li key={c.name} className="flex items-start justify-between gap-3 rounded-[16px] bg-surface p-4">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="t-meta">{c.detail}</p>
              </div>
              <StatusPill tone={c.ok ? "ok" : "plain"}>{c.ok ? "aan" : "uit"}</StatusPill>
            </li>
          ))}
        </ul>
        <p className="t-meta">Koude e-mail: uit. Gaat pas aan na een juridische toets.</p>
      </section>

      {/* Vangrails */}
      <section className="flex flex-col gap-3">
        <h2 className="t-card">Daglimieten</h2>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const limits: Partial<Record<Channel, number>> = {};
            for (const [k, v] of fd.entries()) limits[k as Channel] = Math.max(0, Number(v));
            act(() => saveSettings({ daily_limits: limits }), "Limieten opgeslagen");
          }}
        >
          {(Object.entries(s.daily_limits) as [Channel, number][]).map(([ch, n]) => (
            <label key={ch} className="flex flex-col gap-1">
              <span className="t-meta">{channelLabel(ch)}</span>
              <input name={ch} type="number" min={0} defaultValue={n} className="t-num h-11 rounded-[12px] border border-line bg-bg px-3" />
            </label>
          ))}
          <div className="col-span-2"><TextButton type="submit">Opslaan</TextButton></div>
        </form>
        <p className="t-meta">Verzendvenster: werkdagen 08:00–17:30. Geen tweede benadering binnen 14 dagen.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="t-card">Afmeldlijst</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const v = String(new FormData(form).get("value") ?? "");
            act(() => addSuppression(v, "Handmatig"), "Toegevoegd");
            form.reset();
          }}
        >
          <input name="value" placeholder="e-mail, domein of LinkedIn-URL" className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-bg px-3" />
          <TextButton type="submit">Toevoegen</TextButton>
        </form>
        {props.suppression.length > 0 && (
          <ul className="t-meta flex flex-col gap-1">
            {props.suppression.slice(0, 20).map((x) => <li key={x.id}>{x.value} · {x.reason}</li>)}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="t-card">Logboek</h2>
        {props.log.length === 0 ? (
          <p className="t-meta">Nog niets verzonden.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {props.log.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 rounded-[12px] bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="t-meta">{formatDayTime(l.at)} · {channelLabel(l.channel)} · {l.adapter}</span>
                  <StatusPill tone={l.outcome === "sent" || l.outcome === "manual" ? "ok" : "wait"}>{l.outcome}</StatusPill>
                </div>
                <p className="line-clamp-2 text-[15px]">{l.body}</p>
                {l.detail && <p className="t-meta">{l.detail}</p>}
                {l.external_url && <a className="t-meta underline" href={l.external_url} target="_blank" rel="noreferrer">Bekijk</a>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field(props: { label: string; name: string; value: string; rows: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="t-meta">{props.label}</span>
      <textarea name={props.name} defaultValue={props.value} rows={props.rows} className="rounded-[12px] border border-line bg-bg p-3 outline-none focus:border-ink" />
    </label>
  );
}
