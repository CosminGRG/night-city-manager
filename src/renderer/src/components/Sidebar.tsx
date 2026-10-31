import { List, Settings, type LucideIcon } from 'lucide-react'
import './Sidebar.css'

export type View = 'mods' | 'settings'

const ITEMS: { view: View; label: string; Icon: LucideIcon }[] = [
  { view: 'mods', label: 'Mod list', Icon: List },
  { view: 'settings', label: 'Settings', Icon: Settings }
]

interface SidebarProps {
  view: View
  onChange: (view: View) => void
}

export function Sidebar({ view, onChange }: SidebarProps): React.JSX.Element {
  return (
    <nav className="sidebar" aria-label="Main">
      {ITEMS.map(({ view: item, label, Icon }) => (
        <button
          key={item}
          className={item === view ? 'sidebar-button active' : 'sidebar-button'}
          onClick={() => onChange(item)}
          title={label}
          aria-label={label}
          aria-current={item === view ? 'page' : undefined}
        >
          <Icon size={22} aria-hidden="true" />
        </button>
      ))}
    </nav>
  )
}
