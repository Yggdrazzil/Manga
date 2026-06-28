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
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <NavLink to="/dashboard" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-surface font-display text-xl font-extrabold shadow-soft transition-transform duration-200 ease-out-expo group-hover:-translate-y-0.5">
              空
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl font-extrabold tracking-tight text-vermilion">
                Akiya Radar
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.3em] text-ink-mute">
                cockpit immobilier · japon
              </span>
            </span>
          </NavLink>
          <nav aria-label="Navigation principale">
            <ul className="flex flex-wrap gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-all duration-150 ease-out-expo ${
                        isActive
                          ? "bg-ink text-paper shadow-soft"
                          : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                      }`
                    }
                  >
                    <span className="font-display text-base opacity-80" aria-hidden>
                      {item.jp}
                    </span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
