import { Link } from "react-router-dom";
import { Icon, Logo } from "../App";
import { useStore } from "../state/store";

export default function MorePage() {
  const s = useStore();
  const openDeals = s.deals.filter((d) => !["betaald", "afgewezen"].includes(d.status)).length;
  const items: { to: string; icon: Parameters<typeof Icon>[0]["name"]; title: string; sub: string }[] = [
    { to: "/radar", icon: "radar", title: "Seasonal Radar", sub: "Alle inhakers en kansen" },
    { to: "/opnamedag", icon: "opname", title: "Opnamedag", sub: "Bundel je opnames per locatie" },
    { to: "/deals", icon: "deals", title: "Samenwerkingen", sub: openDeals ? `${openDeals} lopend` : "Deals, deadlines, exclusiviteit" },
    { to: "/studio", icon: "studio", title: "AI Studio", sub: "Snel, Slim of Expert Council" },
    { to: "/maandplanning", icon: "plan", title: "Maandplanning", sub: "Eén knop, hele maand" },
    { to: "/instellingen", icon: "instellingen", title: "Instellingen", sub: "Pijlers, meldingen, eigen momenten" },
  ];
  return (
    <>
      <div className="mb-6"><Logo /></div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 hover:border-accent/50">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon name={i.icon} /></span>
              <span><span className="block font-semibold">{i.title}</span><span className="text-sm text-muted">{i.sub}</span></span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-2xl border border-line bg-card p-4 text-sm">
        <h2 className="text-lg font-semibold">📱 Zet ContentFlow op je beginscherm</h2>
        <p className="mt-1 text-muted">Dan opent het als een echte app, zonder browserbalk.</p>
        <ul className="mt-3 space-y-2">
          <li><b>iPhone (Safari):</b> tik op het deel-icoon <span aria-hidden>⬆️</span> → <i>Zet op beginscherm</i>.</li>
          <li><b>Android (Chrome):</b> tik op ⋮ rechtsboven → <i>App installeren</i> of <i>Toevoegen aan startscherm</i>.</li>
        </ul>
      </section>
    </>
  );
}
