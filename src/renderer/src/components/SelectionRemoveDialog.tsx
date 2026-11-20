import { useState } from 'react'
import { useT } from '@renderer/i18n/context'
import { ConfirmDialog } from './ConfirmDialog'
import type { ModRecord } from '@shared/types'
import { TrashLeftoversOption } from './TrashLeftoversOption'
import { DependentsWarning } from './DependentsWarning'

interface SelectionRemoveDialogProps {
  count: number
  anyDeployed: boolean
  dependents: ModRecord[]
  onConfirm: (trashLeftovers: boolean, alsoOff: ModRecord[]) => void
  onClose: () => void
}

export function SelectionRemoveDialog({
  count,
  anyDeployed,
  dependents,
  onConfirm,
  onClose
}: SelectionRemoveDialogProps): React.JSX.Element {
  const [trashLeftovers, setTrashLeftovers] = useState(false)
  const [alsoOff, setAlsoOff] = useState(false)
  const t = useT()

  return (
    <ConfirmDialog
      title={t('selection.removeTitle', { count })}
      confirmLabel={t('common.remove')}
      onConfirm={() => onConfirm(anyDeployed && trashLeftovers, alsoOff ? dependents : [])}
      onClose={onClose}
    >
      <p>{t('bulk.remove.body', { count })}</p>
      <p className="muted">{t('bulk.remove.note')}</p>
      <DependentsWarning dependents={dependents} alsoOff={alsoOff} onAlsoOffChange={setAlsoOff} />
      {anyDeployed && (
        <TrashLeftoversOption
          checked={trashLeftovers}
          onChange={setTrashLeftovers}
          hint={t('bulk.trashHint')}
        />
      )}
    </ConfirmDialog>
  )
}
