import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/today', label: 'Today' },
  { to: '/week', label: 'Week' },
  { to: '/settings', label: 'Settings' },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#f7efe4] text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#fbf7f0] shadow-2xl shadow-stone-300/30">
        <header className="px-5 pb-4 pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Life-Fit</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Running Coach</h1>
        </header>

        <main className="flex-1 px-5 pb-28">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-2xl px-3 py-3 text-center text-sm font-semibold transition ${
                    isActive ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
