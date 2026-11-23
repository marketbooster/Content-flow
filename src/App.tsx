import { NavLink, Route, Routes } from "react-router-dom";
import CalendarPage from "./pages/CalendarPage";
import ContentPage from "./pages/ContentPage";
import EventPage from "./pages/EventPage";
import MonthPlanPage from "./pages/MonthPlanPage";
import RadarPage from "./pages/RadarPage";
import ReviewPage from "./pages/ReviewPage";
import SettingsPage from "./pages/SettingsPage";
import StudioPage from "./pages/StudioPage";
import SwipePage from "./pages/SwipePage";

const NAV = [
  { to: "/", label: "Radar", icon: "M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2" },
  { to: "/kalender", label: "Kalender", icon: "M4 7h16M4 7v12h16V7M4 7V5h16v2M8 3v4m8-4v4" },
  { to: "/swipe", label: "Swipe", icon: "M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 6 3 3 3-3" },
  { to: "/studio", label: "Studio", icon: "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5Z" },
  { to: "/instellingen", label: "Instellingen", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1-2-4-2 1-2-1-1-2h-4L8 7 6 8 4 7 2 11l2 1v0l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1Z" },
];

export default function App() {
  return (
    <div className="min-h-dvh pb-24 md:pb-0 md:pl-56">
      <nav aria-label="Hoofdmenu" className="safe-bottom fixed bottom-0 inset-x-0 z-20 border-t border-line bg-card/95 backdrop-blur md:inset-y-0 md:right-auto md:w-56 md:border-t-0 md:border-r">
        <div className="hidden md:block px-5 pt-6 pb-8">
          <div className="text-lg font-semibold tracking-tight">ContentFlow</div>
          <div className="text-xs text-muted">Seasonal Intelligence</div>
        </div>
        <ul className="flex justify-around md:flex-col md:gap-1 md:px-3">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 py-2.5 md:rounded-lg text-[11px] md:text-sm ${
                    isActive ? "text-accent md:bg-accent-soft font-semibold" : "text-muted hover:text-ink"
                  }`
                }
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={n.icon} />
                </svg>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto max-w-3xl px-4 pt-5 md:pt-8">
        <Routes>
          <Route path="/" element={<RadarPage />} />
          <Route path="/kalender" element={<CalendarPage />} />
          <Route path="/moment/:key" element={<EventPage />} />
          <Route path="/swipe" element={<SwipePage />} />
          <Route path="/maandplanning" element={<MonthPlanPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/studio/review/:id" element={<ReviewPage />} />
          <Route path="/content/:id" element={<ContentPage />} />
          <Route path="/instellingen" element={<SettingsPage />} />
          <Route path="*" element={<p className="text-muted">Pagina niet gevonden.</p>} />
        </Routes>
      </main>
    </div>
  );
}
