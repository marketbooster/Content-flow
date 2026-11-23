import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type AIJob, type AIMode, type AIStatus, type Brief, type ProviderId } from "../api";
import { Badge, Button, Card, PageHeader, SectionTitle } from "../components/ui";
import { formatNL } from "../domain/dates";
import { ALL_TEMPLATES } from "../domain/monthPlanner";
import { PILLAR_LABELS } from "../domain/profile";
import { useStore } from "../state/store";

const MODES: { id: AIMode; name: string; desc: string }[] = [
  { id: "fast", name: "Snel", desc: "Eén model, laagste kosten." },
  { id: "smart", name: "Slim", desc: "Eén model + aparte kritische controle." },
  { id: "council", name: "Expert Council", desc: "Claude én OpenAI, kruisreview en synthese. Voor belangrijke content." },
];

export default function StudioPage() {
  const s = useStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [mode, setMode] = useState<AIMode>("fast");
  const [primary, setPrimary] = useState<ProviderId>("anthropic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<AIJob | null>(null);
  const [perf, setPerf] = useState("");

  // Context uit de URL: contentitem, moment of bewaard idee.
  const ctx = useMemo(() => {
    const contentId = params.get("content");
    const item = contentId ? s.content.find((c) => c.id === contentId) : undefined;
    const ideaKey = params.get("idea");
    const [tplId, evKey] = ideaKey?.split("@") ?? [];
    const tpl = tplId ? ALL_TEMPLATES.find((t) => t.id === tplId) : undefined;
    const occKey = item?.eventKey ?? evKey ?? params.get("moment") ?? undefined;
    const occ = occKey ? s.occurrences.find((o) => o.key === occKey) : undefined;
    const ev = occ ? s.events.find((e) => e.id === occ.eventId) : undefined;
    return { item, tpl, occ, ev };
  }, [params, s.content, s.occurrences, s.events]);

  const defaultTask = ctx.item
    ? `Werk dit contentidee uit tot hook, script, caption en shotlist: “${ctx.item.title}”.`
    : ctx.tpl
      ? `Maak een originele variatie op dit idee en werk het uit: “${ctx.tpl.title}”.`
      : ctx.ev
        ? `Bedenk een origineel contentidee voor ${ctx.ev.name} dat past bij mijn pijlers, en werk het uit.`
        : "Bedenk een origineel low-cal kerstrecept voor FitMetThies.";
  const [task, setTask] = useState(defaultTask);
  useEffect(() => setTask(defaultTask), [defaultTask]);

  useEffect(() => {
    api.status().then(setStatus).catch((e: Error) => setStatusErr(e.message));
  }, [job]);

  const configured = (id: ProviderId) => status?.providers.find((p) => p.id === id)?.configured ?? false;
  const canRun = status && (mode === "council" ? configured("anthropic") && configured("openai") : configured("anthropic") || configured("openai"));

  const run = async () => {
    setBusy(true); setError(null); setJob(null);
    const idea = ctx.item ?? ctx.tpl;
    const brief: Brief = {
      task,
      creator: {
        name: s.creator.name, brandVoice: s.creator.brandVoice, audience: s.creator.audience,
        pillars: s.creator.pillars.filter((p) => p.weight > 0).map((p) => p.label),
      },
      event: ctx.ev && ctx.occ ? { name: ctx.ev.name, date: formatNL(ctx.occ.start, { year: true }) } : null,
      idea: idea ? { title: idea.title, hook: idea.hook, description: idea.description, format: idea.format, pillar: idea.pillar } : null,
      performanceData: perf.trim() || null,
    };
    try {
      const j = await api.generate(mode, brief, configured(primary) ? primary : primary === "anthropic" ? "openai" : "anthropic");
      setJob(j);
      if (j.status === "mislukt") setError(j.error ?? "Genereren mislukt");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveTo = () => {
    const p = job?.final;
    if (!p) return;
    const patch = {
      title: p.title, hook: p.hook, format: p.format, pillar: p.pillar, description: p.concept,
      script: `${p.script}\n\nCaption:\n${p.caption}`, shotlist: p.shotlist,
      productionMinutes: p.estimatedProductionMinutes, needsNutritionCalc: Boolean(p.recipe) || undefined,
    };
    if (ctx.item) {
      s.updateContent(ctx.item.id, patch);
      navigate(`/content/${ctx.item.id}`);
    } else {
      const [id] = s.addContent([{ ...patch, status: "idee", eventKey: ctx.occ?.key, source: "ai", date: undefined }]);
      navigate(`/content/${id}`);
    }
  };

  return (
    <>
      <PageHeader kicker="AI Content Studio" title="Contentbriefing" sub={ctx.ev ? `Moment: ${ctx.ev.name}` : undefined} />

      <Card>
        <label className="block text-sm font-medium" htmlFor="task">Wat moet er gemaakt worden?</label>
        <textarea id="task" value={task} onChange={(e) => setTask(e.target.value)} rows={3}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper p-3 text-sm" />
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted">Prestatiegegevens toevoegen (optioneel)</summary>
          <p className="mt-1 text-xs text-muted">Alleen echte cijfers uit je account. Zonder gegevens doet de AI geen prestatievoorspellingen.</p>
          <textarea value={perf} onChange={(e) => setPerf(e.target.value)} rows={2} placeholder="Bijv. recept-reels okt: gem. 41k views, 3,2% saves"
            className="mt-1 w-full rounded-xl border border-line bg-paper p-2 text-sm" />
        </details>
      </Card>

      <SectionTitle>AI-modus</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
        {MODES.map((m) => {
          const info = status?.modes.find((x) => x.mode === m.id);
          return (
            <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}
              className={`rounded-2xl border p-3 text-left ${mode === m.id ? "border-accent bg-accent-soft" : "border-line bg-card"}`}>
              <div className="font-semibold">{m.name}</div>
              <div className="mt-0.5 text-xs text-muted">{m.desc}</div>
              {info && <div className="mt-1.5 text-[11px] text-muted tabular">max. {info.maxCalls} aanroep{info.maxCalls > 1 ? "en" : ""} · {info.worstCaseUSD === null ? "kosten onbekend" : `≤ $${info.worstCaseUSD.toFixed(2)}`}</div>}
            </button>
          );
        })}
      </div>
      {mode !== "council" && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted">Model:</span>
          {(["anthropic", "openai"] as ProviderId[]).map((p) => (
            <button key={p} onClick={() => setPrimary(p)} disabled={!configured(p)}
              className={`rounded-full border px-2.5 py-1 text-xs ${primary === p ? "border-accent text-accent" : "border-line"}`}>
              {p === "anthropic" ? "Claude" : "OpenAI"}
            </button>
          ))}
        </div>
      )}

      <ProviderStatus status={status} error={statusErr} />

      <Button className="mt-4 w-full" onClick={run} disabled={!canRun || busy || task.trim().length < 5}>
        {busy ? (mode === "council" ? "Council overlegt… (kan 1–3 min duren)" : "Bezig…") : "Genereer voorstel"}
      </Button>
      {error && <Card className="mt-3 border-red-300 bg-red-50 text-sm text-red-800">{error}</Card>}

      {job?.final && (
        <>
          <SectionTitle action={<Link to={`/studio/review/${job.id}`} className="text-xs text-accent">AI Review →</Link>}>Definitief voorstel</SectionTitle>
          <ProposalView job={job} />
          <Button className="mt-3 w-full" onClick={saveTo}>{ctx.item ? "Opslaan in contentitem" : "Opslaan als nieuw contentitem"}</Button>
        </>
      )}
    </>
  );
}

function ProviderStatus({ status, error }: { status: AIStatus | null; error: string | null }) {
  if (error) return <Card className="mt-3 text-sm text-muted">AI-server niet bereikbaar ({error}). Start de server met <code>npm run dev</code>.</Card>;
  if (!status) return null;
  const { budget } = status;
  return (
    <Card className="mt-3 text-xs">
      <div className="flex flex-wrap gap-2">
        {status.providers.map((p) => (
          <Badge key={p.id} tone={p.configured ? "ok" : "warn"} title={p.problem ?? undefined}>
            {p.label}: {p.configured ? p.model : "niet ingesteld"}
          </Badge>
        ))}
      </div>
      <div className="mt-2 text-muted tabular">
        Deze maand ${budget.spentUSD.toFixed(2)} van ${budget.monthlyBudgetUSD} · Expert Council {budget.councilRunsUsed}/{budget.councilMonthlyLimit}
      </div>
      {status.providers.some((p) => !p.configured) && (
        <p className="mt-1 text-muted">
          Ontbrekende sleutels zet je op de server in <code>.env</code> (zie <code>.env.example</code>). Een ChatGPT- of Claude-abonnement geeft géén API-toegang.
        </p>
      )}
    </Card>
  );
}

export function ProposalView({ job }: { job: AIJob }) {
  const p = job.final!;
  return (
    <Card>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="accent">{p.format}</Badge>
        <Badge tone="plum">{PILLAR_LABELS[p.pillar]}</Badge>
        <Badge tone="warn" title="AI-consensus is geen bewijs. Controleer feiten, voedingswaarden en voorwaarden.">Niet geverifieerd</Badge>
        {job.cached && <Badge>Uit cache (geen kosten)</Badge>}
      </div>
      <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
      <p className="mt-1 italic text-plum">“{p.hook}”</p>
      <Block title="Concept">{p.concept}</Block>
      <Block title="Script"><pre className="whitespace-pre-wrap font-sans">{p.script}</pre></Block>
      <Block title="Caption"><pre className="whitespace-pre-wrap font-sans">{p.caption}</pre></Block>
      <Block title="Shotlist"><ol className="list-decimal pl-5">{p.shotlist.map((x, i) => <li key={i}>{x}</li>)}</ol></Block>
      {p.recipe && (
        <Block title={`Recept (${p.recipe.servings} porties)`}>
          <ul className="list-disc pl-5">{p.recipe.ingredients.map((i, k) => <li key={k}>{i.amount} {i.unit} {i.item}</li>)}</ul>
          <ol className="mt-2 list-decimal pl-5">{p.recipe.steps.map((x, k) => <li key={k}>{x}</li>)}</ol>
          <p className="mt-2 rounded-lg bg-warn-soft p-2 text-xs text-warn">Voedingswaarden zijn nog niet berekend. Bereken ze uit deze ingrediënten (bijv. met NEVO-gegevens) vóór je calorieën noemt.</p>
        </Block>
      )}
      <Transparency job={job} />
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>{children}</div>;
}

function Transparency({ job }: { job: AIJob }) {
  const p = job.final!;
  const list = (t: string, xs: string[]) => xs.length > 0 && <div className="mt-2"><div className="font-medium">{t}</div><ul className="list-disc pl-5">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul></div>;
  return (
    <details className="mt-4 rounded-xl bg-paper p-3 text-xs">
      <summary className="cursor-pointer font-medium">Transparantie · {job.modelsUsed.join(" + ")} · ${job.totalCostUSD.toFixed(3)}</summary>
      {job.fallbackUsed && <p className="mt-2 text-warn">{job.fallbackUsed}</p>}
      {list("Aannames", p.assumptions)}
      {list("Ontbrekende gegevens", p.missingData)}
      {list("Nog te controleren", p.factChecksNeeded)}
      {job.changeLog.length > 0 && list("Waarom aangepast", job.changeLog.map((c) => `${c.change} — ${c.reason}`))}
      {list("Open vragen voor jou", job.openQuestions)}
      <p className="mt-2 text-muted">Bronnen: geen externe bronnen geraadpleegd. Status: niet geverifieerd.</p>
    </details>
  );
}
