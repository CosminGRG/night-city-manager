import { CircleArrowUp, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@shared/i18n/en'
import { MOD_VIEWS, type ModView } from '@renderer/modFilters'
import { useT } from '@renderer/i18n/context'
import './ModViewTabs.css'

const VIEW_LABELS: Record<ModView, MessageKey> = {
  all: 'mods.view.all',
  active: 'mods.view.active',
  inactive: 'mods.view.inactive',
  attention: 'mods.view.attention',
  updates: 'mods.view.updates'
}

const VIEW_ICONS: Partial<Record<ModView, LucideIcon>> = {
  attention: TriangleAlert,
  updates: CircleArrowUp
}

interface ModViewTabsProps {
  view: ModView
  counts: Record<ModView, number>
  onChange: (view: ModView) => void
}

export function ModViewTabs({ view, counts, onChange }: ModViewTabsProps): React.JSX.Element {
  const t = useT()

  return (
    <div className="view-tabs" role="group" aria-label={t('mods.views')}>
      {MOD_VIEWS.map((item) => {
        const Icon = VIEW_ICONS[item]

        return (
          <button
            key={item}
            className={`view-tab view-${item}`}
            aria-pressed={item === view}
            onClick={() => onChange(item)}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {t(VIEW_LABELS[item])}
            <span className="view-count">{counts[item]}</span>
          </button>
        )
      })}
    </div>
  )
}
