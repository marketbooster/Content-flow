import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import BoardPage from "./pages/BoardPage";
import CalendarPage from "./pages/CalendarPage";
import ContentPage from "./pages/ContentPage";
import DealsPage from "./pages/DealsPage";
import EventPage from "./pages/EventPage";
import MonthPlanPage from "./pages/MonthPlanPage";
import MorePage from "./pages/MorePage";
import RadarPage from "./pages/RadarPage";
import ReviewPage from "./pages/ReviewPage";
import SettingsPage from "./pages/SettingsPage";
import ShootPage from "./pages/ShootPage";
import StudioPage from "./pages/StudioPage";
import SwipePage from "./pages/SwipePage";
import TodayPage from "./pages/TodayPage";

const ICONS = {
  vandaag: "M12 4v2m0 12v2M4 12h2m12 0h2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4M6.3 17.7l1.4-1.4m8.6-8.6 1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  kalender: "M4 7h16M4 7v12h16V7M4 7V5h16v2M8 3v4m8-4v4",
  bord: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z",
  swipe: "M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm5 5.5c-1.2-1.6-4-1-4 1.2 0 1.8 2.3 3.2 4 4.8 1.7-1.6 4-3 4-4.8 0-2.2-2.8-2.8-4-1.2Z",
  meer: "M5 12h.01M12 12h.01M19 12h.01",
  radar: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 12l5-5",
  opname: "M4 7h11v10H4zM15 10l5-3v10l-5-3",
  deals: "M3 12l4-4 4 3 4-5 6 6M3 18h18",
  studio: "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5Z",
  plan: "M5 5h14v14H5zM9 9h6M9 13h6M9 17h3",
  instellingen: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1-2-4-2 1-2-1-1-2h-4L8 7 6 8 4 7 2 11l2 1-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1Z",
} as const;

type NavItem = { to: string; label: string; icon: keyof typeof ICONS };
// Onderbalk op de telefoon: vijf vaste plekken.
const MOBILE: NavItem[] = [
  { to: "/", label: "Vandaag", icon: "vandaag" },
  { to: "/kalender", label: "Kalender", icon: "kalender" },
  { to: "/bord", label: "Bord", icon: "bord" },
  { to: "/swipe", label: "Swipe", icon: "swipe" },
  { to: "/meer", label: "Meer", icon: "meer" },
];
// Zijbalk op desktop: alles direct bereikbaar.
const DESKTOP: NavItem[] = [
  ...MOBILE.slice(0, 4),
  { to: "/radar", label: "Seasonal Radar", icon: "radar" },
  { to: "/opnamedag", label: "Opnamedag", icon: "opname" },
  { to: "/deals", label: "Samenwerkingen", icon: "deals" },
  { to: "/studio", label: "AI Studio", icon: "studio" },
  { to: "/maandplanning", label: "Maandplanning", icon: "plan" },
  { to: "/instellingen", label: "Instellingen", icon: "instellingen" },
];

export function Icon({ name, className = "size-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="bg-brand grid size-9 place-items-center rounded-full font-display text-sm font-semibold">CF</span>
      <span className="font-display text-lg font-semibold tracking-tight">Content<span className="gradient-text">Flow</span></span>
    </span>
  );
}

export default function App() {
  // Het productiebord krijgt op grote schermen de volle breedte; de rest blijft leesbaar smal.
  const wide = useLocation().pathname === "/bord";
  return (
    <div className="min-h-dvh pb-24 md:pb-0 md:pl-60">
      <nav aria-label="Hoofdmenu" className="safe-bottom fixed bottom-0 inset-x-0 z-20 border-t border-line bg-card/95 backdrop-blur md:inset-y-0 md:right-auto md:w-60 md:border-t-0 md:border-r">
        <div className="hidden px-5 pt-6 pb-6 md:block">
          <Logo />
          <div className="mt-1 pl-11 text-xs text-muted">voor FitMetThies</div>
        </div>
        <ul className="flex justify-around md:hidden">
          {MOBILE.map((n) => <li key={n.to}><NavItemLink item={n} /></li>)}
        </ul>
        <ul className="hidden flex-col gap-0.5 px-3 md:flex">
          {DESKTOP.map((n) => <li key={n.to}><NavItemLink item={n} /></li>)}
        </ul>
      </nav>
      <main className={`mx-auto px-4 pt-5 md:pt-8 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/radar" element={<RadarPage />} />
          <Route path="/kalender" element={<CalendarPage />} />
          <Route path="/bord" element={<BoardPage />} />
          <Route path="/moment/:key" element={<EventPage />} />
          <Route path="/swipe" element={<SwipePage />} />
          <Route path="/maandplanning" element={<MonthPlanPage />} />
          <Route path="/opnamedag" element={<ShootPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/studio/review/:id" element={<ReviewPage />} />
          <Route path="/content/:id" element={<ContentPage />} />
          <Route path="/instellingen" element={<SettingsPage />} />
          <Route path="/meer" element={<MorePage />} />
          <Route path="*" element={<p className="text-muted">Pagina niet gevonden.</p>} />
        </Routes>
      </main>
    </div>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-3 py-2.5 text-[11px] md:flex-row md:gap-3 md:rounded-xl md:text-sm ${
          isActive ? "font-semibold text-accent md:bg-accent-soft" : "text-muted hover:text-ink"
        }`
      }
    >
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );
}
