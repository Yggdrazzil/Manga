import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/dashboard", label: "Tableau de bord", jp: "盤" },
  { to: "/listings", label: "Annonces", jp: "件" },
  { to: "/map", label: "Carte", jp: "図" },
  { to: "/import", label: "Importer", jp: "入" },
  { to: "/sources", label: "Sources", jp: "源" },
  { to: "/saved-searches", label: "Recherches", jp: "探" },
  { to: "/settings", label: "Réglages", jp: "設" },
];

export function Layout() {
  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col px-4 pb-16 pt-4 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <NavLink to="/dashboard" className="group flex items-baseline gap-3">
          <span className="font-display text-4xl font-extrabold tracking-tight">
            空き家
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-2xl font-extrabold text-vermilion">
              Akiya Radar
            </span>
            <span className="text-[11px] uppercase tracking-[0.3em] text-ink-mute">
              cockpit immobilier · japon
            </span>
          </span>
        </NavLink>
        <nav aria-label="Navigation principale">
          <ul className="flex flex-wrap gap-1.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 border-2 px-3 py-1.5 text-sm font-bold transition-colors duration-150 ${
                      isActive
                        ? "border-ink bg-ink text-paper"
                        : "border-ink/20 text-ink-soft hover:border-ink hover:bg-paper-2"
                    }`
                  }
                >
                  <span className="font-display text-base" aria-hidden>
                    {item.jp}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
