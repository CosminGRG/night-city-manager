import { useState } from 'react'
import type { ModRecord } from '@shared/types'
import { ConfirmDialog } from './ConfirmDialog'
import { TrashLeftoversOption } from './TrashLeftoversOption'

interface RemoveConfirmDialogProps {
  mod: ModRecord
  deployed: boolean
  onConfirm: (trashLeftovers: boolean) => void
  onClose: () => void
}

export function RemoveConfirmDialog({
  mod,
  deployed,
  onConfirm,
  onClose
}: RemoveConfirmDialogProps): React.JSX.Element {
  const [trashLeftovers, setTrashLeftovers] = useState(false)

  return (
    <ConfirmDialog
      title={`Remove ${mod.name}?`}
      confirmLabel="Remove"
      onConfirm={() => onConfirm(deployed && trashLeftovers)}
      onClose={onClose}
    >
      <p>It will be taken off your mod list {deployed ? 'and out of your game' : ''}</p>
      <p className="muted">
        Your downloaded archive stays where it is, so you can import it again anytime.
      </p>
      {deployed && (
        <TrashLeftoversOption
          checked={trashLeftovers}
          onChange={setTrashLeftovers}
          hint="Settings, logs and saved mod data wrote into the folders it created in the game."
        />
      )}
    </ConfirmDialog>
  )
}
