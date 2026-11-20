import { useState } from 'react'
import { useT } from '@renderer/i18n/context'
import { ConfirmDialog } from './ConfirmDialog'
import { TrashLeftoversOption } from './TrashLeftoversOption'

interface SelectionRemoveDialogProps {
  count: number
  anyDeployed: boolean
  onConfirm: (trashLeftovers: boolean) => void
  onClose: () => void
}

export function SelectionRemoveDialog({
  count,
  anyDeployed,
  onConfirm,
  onClose
}: SelectionRemoveDialogProps): React.JSX.Element {
  const [trashLeftovers, setTrashLeftovers] = useState(false)
  const t = useT()

  return (
    <ConfirmDialog
      title={t('selection.removeTitle', { count })}
      confirmLabel={t('common.remove')}
      onConfirm={() => onConfirm(anyDeployed && trashLeftovers)}
      onClose={onClose}
    >
      <p>{t('bulk.remove.body', { count })}</p>
      <p className="muted">{t('bulk.remove.note')}</p>
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
