import { List, Settings, PackagePlus, Wrench, type LucideIcon } from 'lucide-react'
import { LaunchButton } from './LaunchButton'
import './Sidebar.css'

export type View = 'mods' | 'import' | 'troubleshoot' | 'settings'

const ITEMS: { view: View; label: string; Icon: LucideIcon }[] = [
  { view: 'mods', label: 'Mod list', Icon: List },
  { view: 'import', label: 'Import', Icon: PackagePlus },
  { view: 'troubleshoot', label: 'Troubleshoot', Icon: Wrench },
  { view: 'settings', label: 'Settings', Icon: Settings }
]

interface SidebarProps {
  view: View
  onChange: (view: View) => void
  gamePath: string | null
}

export function Sidebar({ view, onChange, gamePath }: SidebarProps): React.JSX.Element {
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
      <LaunchButton gamePath={gamePath} />
    </nav>
  )
}
