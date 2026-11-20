import { useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { TriangleAlert } from 'lucide-react'
import type { ModRecord } from '@shared/types'
import { useT } from '@renderer/i18n/context'
import './ConfirmDialog.css'
import './TrashLeftoversOption.css'
import './DependentsDialog.css'

interface DependentsDialogProps {
  mods: ModRecord[]
  dependents: ModRecord[]
  onAnyway: (stopAsking: boolean) => void
  onAlso: (stopAsking: boolean) => void
  onClose: () => void
}

export function DependentsDialog({
  mods,
  dependents,
  onAnyway,
  onAlso,
  onClose
}: DependentsDialogProps): React.JSX.Element {
  const [stopAsking, setStopAsking] = useState(false)
  const t = useT()

  return (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog dependents-dialog">
          <AlertDialog.Title className="dialog-title">
            {t('off.title', { count: mods.length, name: mods[0]?.name ?? '' })}
          </AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="dialog-body">
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
                  checked={stopAsking}
                  onChange={(event) => setStopAsking(event.target.checked)}
                />
                <span>
                  {t('off.stopAsking')}
                  <span className="muted">{t('off.stopAskingHint')}</span>
                </span>
              </label>
            </div>
          </AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild>
              <button>{t('common.cancel')}</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button onClick={() => onAnyway(stopAsking)}>{t('off.anyway')}</button>
            </AlertDialog.Action>
            <AlertDialog.Action asChild>
              <button className="primary" onClick={() => onAlso(stopAsking)}>
                {t('off.also', { count: dependents.length })}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
