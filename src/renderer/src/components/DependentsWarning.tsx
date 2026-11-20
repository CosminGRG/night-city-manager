import { TriangleAlert } from 'lucide-react'
import type { ModRecord } from '@shared/types'
import { useT } from '@renderer/i18n/context'
import './TrashLeftoversOption.css'
import './DependentsDialog.css'

interface DependentsWarningProps {
  dependents: ModRecord[]
  alsoOff: boolean
  onAlsoOffChange: (alsoOff: boolean) => void
}

// The "other mods need this" list for dialogs that already confirm (Remove).
export function DependentsWarning({
  dependents,
  alsoOff,
  onAlsoOffChange
}: DependentsWarningProps): React.JSX.Element | null {
  const t = useT()

  if (dependents.length === 0) {
    return null
  }

  return (
    <div className="dependents-block">
      <p className="with-icon dependents-warning">
        <TriangleAlert size={16} aria-hidden="true" />
        {t('off.body', { count: dependents.length })}
      </p>
      <ul className="dependents-list">
        {dependents.map((mod) => (
          <li key={mod.id}>{mod.name}</li>
        ))}
      </ul>
      <label className="confirm-option">
        <input
          type="checkbox"
          checked={alsoOff}
          onChange={(event) => onAlsoOffChange(event.target.checked)}
        />
        <span>{t('off.alsoOption', { count: dependents.length })}</span>
      </label>
    </div>
  )
}
