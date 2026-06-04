const NAV = [
  { id: 'attio',           label: 'Attio pipeline follow-ups',       icon: '🔁' },
  { id: 'connections',     label: 'LinkedIn connection requests',     icon: '🤝' },
  { id: 'update_accepted', label: 'Update accepted connections',      icon: '✅' },
  { id: 'remove_old',      label: 'Remove old pending requests',      icon: '🗑' },
  { id: 'linkedin_dm',     label: 'LinkedIn DM',                      icon: '💬' },
  { id: 'email',           label: 'Email',                            icon: '✉️' },
  { id: 'summary',         label: 'Daily summary',                    icon: '📊' },
]

export default function Sidebar({ active, onSelect }) {
  return (
    <nav className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-slate-700">
        <h1 className="font-semibold text-base tracking-tight">Daily Outbound</h1>
      </div>
      <ul className="flex-1 py-3">
        {NAV.map(item => (
          <li key={item.id}>
            <button
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-start gap-3 px-5 py-3 text-sm text-left transition-colors ${
                active === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base leading-none mt-0.5">{item.icon}</span>
              <span className="leading-snug">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
