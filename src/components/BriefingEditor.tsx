// Briefing bij een video: schrijven/plakken, uploaden (PDF, foto, tekst), overnemen uit deal
// of shotlist, en omzetten naar shots (lokaal of met AI). Alles wordt direct bewaard.
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type BriefingFileType } from "../api";
import { emptyBriefing, shotId, splitIntoShots } from "../domain/briefing";
import type { Briefing, ContentItem, Shot } from "../domain/types";
import { compressImage, kindOf, MAX_UPLOAD_BYTES, readAsBase64, readAsText, splitDataUrl } from "../lib/files";
import { useStore } from "../state/store";
import { Badge, Button, Card, SectionTitle } from "./ui";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function BriefingEditor({ item }: { item: ContentItem }) {
  const s = useStore();
  const b = item.briefing ?? emptyBriefing();
  const deal = item.dealId ? s.deals.find((d) => d.id === item.dealId) : undefined;
  const [pdf, setPdf] = useState<{ base64: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = Boolean(import.meta.env.VITE_PREVIEW);

  const save = (patch: Partial<Briefing>) =>
    s.updateContent(item.id, { briefing: { ...b, ...patch, updatedAt: new Date().toISOString() } });

  const splitLocal = () => {
    const r = splitIntoShots(b.text);
    if (r.shots.length === 0) return setMsg({ tone: "err", text: "Geen shots gevonden. Zet elk shot op een eigen regel, bijvoorbeeld “1. Intro…”." });
    save({ ...r, source: b.source === "upload" ? "upload" : "handmatig" });
    setMsg({ tone: "ok", text: `${r.shots.length} shots gemaakt. Controleer ze hieronder.` });
  };

  const splitAI = async () => {
    setBusy("ai"); setMsg(null);
    try {
      const image = !pdf && b.images[0] ? splitDataUrl(b.images[0]) : null;
      const file = pdf
        ? { mediaType: "application/pdf" as BriefingFileType, base64: pdf.base64, fileName: pdf.name }
        : image ? { mediaType: image.mediaType as BriefingFileType, base64: image.base64, fileName: "briefing.jpg" } : undefined;
      const r = await api.briefing({ item: { title: item.title, format: item.format }, text: b.text || undefined, file });
      save({
        shots: r.shots.map((x) => ({ id: shotId(), title: x.title, say: x.say || undefined, mustInclude: x.mustInclude, notes: x.notes || undefined })),
        alwaysInclude: r.alwaysInclude, dos: r.dos, donts: r.donts, deadlines: r.deadlines, openQuestions: r.unclear, source: "ai",
      });
      setMsg({ tone: "ok", text: `${r.shots.length} shots gemaakt door ${r.model} ($${r.costUSD.toFixed(3)}${r.cached ? ", uit cache" : ""}). Controleer ze: AI kan zich vergissen.` });
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File) => {
    setMsg(null);
    if (file.size > MAX_UPLOAD_BYTES) return setMsg({ tone: "err", text: "Bestand is groter dan 10 MB." });
    setBusy("upload");
    try {
      const kind = kindOf(file);
      if (kind === "text") {
        save({ text: await readAsText(file), fileName: file.name, source: "upload" });
        setMsg({ tone: "ok", text: "Tekst ingelezen. Maak er nu shots van." });
      } else if (kind === "image") {
        if (b.images.length >= 4) throw new Error("Maximaal 4 afbeeldingen per briefing.");
        save({ images: [...b.images, await compressImage(file)], fileName: file.name, source: "upload" });
        setMsg({ tone: "ok", text: "Afbeelding toegevoegd. Je ziet hem groot in de opnamemodus. Met AI kun je er ook shots van maken." });
      } else if (kind === "pdf") {
        setPdf({ base64: await readAsBase64(file), name: file.name });
        save({ fileName: file.name, source: "upload" });
        setMsg({ tone: "ok", text: "PDF klaar. Laat AI er shots van maken (de PDF zelf wordt niet op je telefoon bewaard)." });
      } else {
        throw new Error("Dit bestandstype wordt niet ondersteund. Gebruik PDF, een foto/screenshot of een tekstbestand.");
      }
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateShot = (id: string, patch: Partial<Shot>) => save({ shots: b.shots.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const moveShot = (i: number, d: -1 | 1) => {
    const next = [...b.shots];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    save({ shots: next });
  };
  const field = "mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm";

  return (
    <>
      <SectionTitle action={b.shots.length > 0 || b.images.length > 0 ? (
        <Link to={`/opnamemodus?content=${item.id}`} className="btn-gradient rounded-full px-4 py-1.5 text-sm font-semibold">🎬 Opnamemodus</Link>
      ) : undefined}>Briefing</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted">Zet hier de briefing van het merk of je eigen plan. In de opnamemodus zie je hem per shot groot in beeld.</p>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy !== null}>📎 Upload PDF / foto / tekst</Button>
          <input ref={fileRef} id="briefing-file" type="file" accept=".pdf,application/pdf,image/*,.txt,.md,text/plain" className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {deal?.notes && (
            <Button variant="secondary" onClick={() => save({ text: deal.notes, source: "deal" })}>Uit deal {deal.brand}</Button>
          )}
          {(item.shotlist?.filter(Boolean).length ?? 0) > 0 && (
            <Button variant="secondary" onClick={() => save({
              shots: item.shotlist!.filter((x) => x.trim()).map((x) => ({ id: shotId(), title: x.trim(), mustInclude: [] })), source: "shotlist",
            })}>Uit shotlist</Button>
          )}
        </div>

        <label className="block text-sm">Briefingtekst (typ of plak)
          <textarea id="briefing-text" rows={6} className={field} value={b.text} placeholder={"Bijvoorbeeld:\nVermeld altijd #ad en @merk\n1. Intro: product in de hand\n2. Laat de textuur zien\n3. Afsluiter met kortingscode THIES10\nDon't: andere merken in beeld"}
            onChange={(e) => save({ text: e.target.value })} />
        </label>

        {(pdf || b.fileName || b.images.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {pdf && <Badge tone="accent">📄 {pdf.name}</Badge>}
            {!pdf && b.fileName && b.images.length === 0 && <Badge>📄 {b.fileName} (opnieuw uploaden voor AI)</Badge>}
            {b.images.map((src, i) => (
              <span key={i} className="relative">
                <img src={src} alt={`Briefing-afbeelding ${i + 1}`} className="size-16 rounded-lg border border-line object-cover" />
                <button onClick={() => save({ images: b.images.filter((_, j) => j !== i) })} aria-label="Afbeelding verwijderen"
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-[10px] text-paper">✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={splitLocal} disabled={!b.text.trim() || busy !== null}>Maak shots van tekst</Button>
          {preview ? (
            <span className="self-center text-xs text-warn">AI-omzetten werkt op je eigen ContentFlow-adres, niet in de preview.</span>
          ) : (
            <Button onClick={splitAI} disabled={busy !== null || (!b.text.trim() && !pdf && b.images.length === 0)}>
              {busy === "ai" ? "AI leest de briefing…" : "✨ Met AI omzetten naar shots"}
            </Button>
          )}
        </div>
        {msg && <p className={`text-sm ${msg.tone === "ok" ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
      </Card>

      {(b.shots.length > 0 || b.alwaysInclude.length > 0) && (
        <Card className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sans font-semibold">{b.shots.length} shots</h3>
            <Button variant="ghost" onClick={() => setEditing(!editing)}>{editing ? "Klaar" : "Bewerken"}</Button>
          </div>

          {b.openQuestions && b.openQuestions.length > 0 && (
            <div className="rounded-xl bg-warn-soft p-3 text-sm text-warn">
              <b>Navragen bij het merk:</b>
              <ul className="list-disc pl-5">{b.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}

          {editing ? (
            <>
              <label className="block text-sm">Altijd in beeld/tekst (één per regel)
                <textarea rows={2} className={field} value={b.alwaysInclude.join("\n")} onChange={(e) => save({ alwaysInclude: lines(e.target.value) })} />
              </label>
              {b.shots.map((x, i) => (
                <div key={x.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-semibold tabular">{i + 1}</span>
                    <input className={`${field} mt-0 flex-1`} value={x.title} aria-label={`Titel shot ${i + 1}`} onChange={(e) => updateShot(x.id, { title: e.target.value })} />
                    <button disabled={i === 0} onClick={() => moveShot(i, -1)} aria-label="Omhoog" className="text-muted">↑</button>
                    <button disabled={i === b.shots.length - 1} onClick={() => moveShot(i, 1)} aria-label="Omlaag" className="text-muted">↓</button>
                    <button onClick={() => save({ shots: b.shots.filter((y) => y.id !== x.id) })} aria-label="Shot verwijderen" className="text-danger">✕</button>
                  </div>
                  <label className="mt-2 block text-xs text-muted">Wat zeg je / tekst in beeld
                    <textarea rows={2} className={field} value={x.say ?? ""} onChange={(e) => updateShot(x.id, { say: e.target.value || undefined })} />
                  </label>
                  <label className="mt-2 block text-xs text-muted">Moet erin (één per regel)
                    <textarea rows={2} className={field} value={x.mustInclude.join("\n")} onChange={(e) => updateShot(x.id, { mustInclude: lines(e.target.value) })} />
                  </label>
                </div>
              ))}
              <Button variant="secondary" onClick={() => save({ shots: [...b.shots, { id: shotId(), title: "Nieuw shot", mustInclude: [] }] })}>+ Shot</Button>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">Do's (één per regel)
                  <textarea rows={3} className={field} value={b.dos.join("\n")} onChange={(e) => save({ dos: lines(e.target.value) })} />
                </label>
                <label className="block text-sm">Don'ts (één per regel)
                  <textarea rows={3} className={field} value={b.donts.join("\n")} onChange={(e) => save({ donts: lines(e.target.value) })} />
                </label>
              </div>
            </>
          ) : (
            <>
              {b.alwaysInclude.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{b.alwaysInclude.map((x, i) => <Badge key={i} tone="warn">Altijd: {x}</Badge>)}</div>
              )}
              <ol className="space-y-2">
                {b.shots.map((x, i) => (
                  <li key={x.id} className="flex gap-3 text-sm">
                    <span className="font-display text-lg font-semibold text-accent tabular">{i + 1}</span>
                    <div>
                      <div className="font-medium">{x.title}</div>
                      {x.say && <div className="italic text-plum">“{x.say}”</div>}
                      {x.mustInclude.length > 0 && <div className="text-xs text-warn">Moet erin: {x.mustInclude.join(" · ")}</div>}
                    </div>
                  </li>
                ))}
              </ol>
              {(b.dos.length > 0 || b.donts.length > 0) && (
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {b.dos.length > 0 && <div className="rounded-xl bg-ok-soft p-3"><b>Do's</b><ul className="list-disc pl-5">{b.dos.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                  {b.donts.length > 0 && <div className="rounded-xl bg-danger/10 p-3"><b>Don'ts</b><ul className="list-disc pl-5">{b.donts.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </>
  );
}
