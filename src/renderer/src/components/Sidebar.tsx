import { List, Settings, PackagePlus, Wrench, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@shared/i18n/en'
import { useT } from '../i18n/context'
import { LaunchButton } from './LaunchButton'
import './Sidebar.css'

export type View = 'mods' | 'import' | 'troubleshoot' | 'settings'

const ITEMS: { view: View; label: MessageKey; Icon: LucideIcon }[] = [
  { view: 'mods', label: 'nav.mods', Icon: List },
  { view: 'import', label: 'nav.import', Icon: PackagePlus },
  { view: 'troubleshoot', label: 'nav.troubleshoot', Icon: Wrench },
  { view: 'settings', label: 'nav.settings', Icon: Settings }
]

interface SidebarProps {
  view: View
  onChange: (view: View) => void
  gamePath: string | null
}

export function Sidebar({ view, onChange, gamePath }: SidebarProps): React.JSX.Element {
  const t = useT()

  return (
    <nav className="sidebar" aria-label={t('nav.main')}>
      {ITEMS.map(({ view: item, label, Icon }) => (
        <button
          key={item}
          className={item === view ? 'sidebar-button active' : 'sidebar-button'}
          onClick={() => onChange(item)}
          title={t(label)}
          aria-label={t(label)}
          aria-current={item === view ? 'page' : undefined}
        >
          <Icon size={22} aria-hidden="true" />
        </button>
      ))}
      <LaunchButton gamePath={gamePath} />
    </nav>
  )
}
