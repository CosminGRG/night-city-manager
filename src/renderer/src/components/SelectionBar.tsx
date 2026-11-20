import { Power, PowerOff, Trash2, X } from 'lucide-react'
import type { BulkAction } from '@shared/types'
import type { CheckState } from '@renderer/selection'
import { useT } from '@renderer/i18n/context'
import { RoundCheck } from './RoundCheck'
import './SelectionBar.css'

interface SelectionBarProps {
  selected: number
  state: CheckState
  counts: Record<BulkAction, number>
  locked: boolean
  onToggleAll: () => void
  onAction: (action: BulkAction) => void
  onClear: () => void
}

export function SelectionBar({
  selected,
  state,
  counts,
  locked,
  onToggleAll,
  onAction,
  onClear
}: SelectionBarProps): React.JSX.Element {
  const t = useT()

  return (
    <div className="selection-bar" role="toolbar" aria-label={t('selection.toolbar')}>
      <RoundCheck state={state} label={t('mods.selectAll')} onToggle={onToggleAll} />
      <span className="selection-count">{t('selection.count', { count: selected })}</span>
      <span className="muted selection-scope">{t('selection.inView')}</span>

      <span className="selection-actions">
        <button
          className="small primary with-icon"
          disabled={locked || counts.deploy === 0}
          onClick={() => onAction('deploy')}
        >
          <Power size={14} aria-hidden="true" />
          {t('selection.deploy')}
          <span className="selection-n">{counts.deploy}</span>
        </button>
        <button
          className="small with-icon"
          disabled={locked || counts.purge === 0}
          onClick={() => onAction('purge')}
        >
          <PowerOff size={14} aria-hidden="true" />
          {t('selection.undeploy')}
          <span className="selection-n">{counts.purge}</span>
        </button>
        <button
          className="small danger with-icon"
          disabled={locked || counts.remove === 0}
          onClick={() => onAction('remove')}
        >
          <Trash2 size={14} aria-hidden="true" />
          {t('common.remove')}
          <span className="selection-n">{counts.remove}</span>
        </button>
        <button className="small with-icon" onClick={onClear}>
          <X size={14} aria-hidden="true" />
          {t('selection.clear')}
        </button>
      </span>
    </div>
  )
}
