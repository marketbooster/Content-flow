import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type AIJob, type Proposal, type Review } from "../api";
import { Badge, Card, Empty, PageHeader, SectionTitle } from "../components/ui";

const LABEL = { anthropic: "Claude", openai: "OpenAI" } as const;
const MODE = { fast: "Snel", smart: "Slim", council: "Expert Council" } as const;

export default function ReviewPage() {
  const { id = "" } = useParams();
  const [job, setJob] = useState<AIJob | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.job(id).then(setJob).catch((e: Error) => setErr(e.message)); }, [id]);
  if (err) return <Empty>{err}</Empty>;
  if (!job) return <p className="text-sm text-muted">Laden…</p>;

  const proposals = job.steps.filter((s) => s.kind === "proposal" && s.output);
  const reviews = job.steps.filter((s) => s.kind === "review" && s.output);

  return (
    <>
      <Link to="/studio" className="text-sm text-muted">← Studio</Link>
      <PageHeader kicker={`AI Review · ${MODE[job.mode]}`} title={job.final?.title ?? "Mislukte generatie"}
        sub={`${new Date(job.createdAt).toLocaleString("nl-NL")} · ${job.modelsUsed.join(" + ") || "—"} · $${job.totalCostUSD.toFixed(3)}`} />

      <Card className="border-warn/40 bg-warn-soft text-sm">
        Twee AI's die het eens zijn, hebben niet automatisch gelijk. Status: <b>niet geverifieerd</b>. Recepten, voedingswaarden, trends en campagnevoorwaarden controleer je met echte bronnen.
      </Card>

      {job.differences.length > 0 && (
        <>
          <SectionTitle>Verschillen en risico's</SectionTitle>
          <Card><dl className="space-y-2 text-sm">{job.differences.map((d, i) => <div key={i}><dt className="font-medium">{d.topic}</dt><dd className="text-muted">{d.detail}</dd></div>)}</dl></Card>
        </>
      )}

      {proposals.length > 0 && (
        <>
          <SectionTitle>Onafhankelijke voorstellen</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
            {proposals.map((s, i) => {
              const p = s.output as Proposal;
              const r = reviews.find((x) => x.reviewOf === s.provider)?.output as Review | undefined;
              return (
                <Card key={i}>
                  <Badge tone="plum">{LABEL[s.provider]}</Badge>
                  <div className="mt-1.5 font-medium">{p.title}</div>
                  <p className="text-sm italic text-plum">“{p.hook}”</p>
                  <p className="mt-1 text-xs text-muted">{p.format} · ± {p.estimatedProductionMinutes} min</p>
                  {r && (
                    <div className="mt-3 text-xs">
                      <div className="font-medium">Beoordeling door het andere model: {r.verdict}</div>
                      <ul className="mt-1 grid grid-cols-2 gap-x-3 tabular">
                        {Object.entries(r.scores).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-muted">{k}</span><span>{v}/5</span></li>)}
                      </ul>
                      {r.possibleErrors.length > 0 && <p className="mt-1 text-warn">Mogelijke fouten: {r.possibleErrors.join("; ")}</p>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {job.changeLog.length > 0 && (
        <>
          <SectionTitle>Waarom het voorstel is aangepast</SectionTitle>
          <Card><ul className="list-disc space-y-1 pl-5 text-sm">{job.changeLog.map((c, i) => <li key={i}><b>{c.change}</b> — {c.reason}</li>)}</ul></Card>
        </>
      )}

      <SectionTitle>Stappen</SectionTitle>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-xs tabular">
          <thead className="text-muted"><tr><th className="p-2">Stap</th><th className="p-2">Model</th><th className="p-2 text-right">Tokens in/uit</th><th className="p-2 text-right">Kosten</th></tr></thead>
          <tbody>
            {job.steps.map((s, i) => (
              <tr key={i} className="border-t border-line">
                <td className="p-2">{s.name}{s.error && <div className="text-danger">{s.error}</div>}</td>
                <td className="p-2">{LABEL[s.provider]} · {s.model}</td>
                <td className="p-2 text-right">{s.inputTokens.toLocaleString("nl-NL")} / {s.outputTokens.toLocaleString("nl-NL")}</td>
                <td className="p-2 text-right">${s.costUSD.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
