import { useState } from 'react'
import type { ModRecord } from '@shared/types'
import { ConfirmDialog } from './ConfirmDialog'
import { TrashLeftoversOption } from './TrashLeftoversOption'

interface RemoveConfirmDialogProps {
  mod: ModRecord
  otherVersions: ModRecord[]
  deployed: boolean
  onConfirm: (trashLeftovers: boolean, allVersions: boolean) => void
  onClose: () => void
}

export function RemoveConfirmDialog({
  mod,
  otherVersions,
  deployed,
  onConfirm,
  onClose
}: RemoveConfirmDialogProps): React.JSX.Element {
  const [trashLeftovers, setTrashLeftovers] = useState(false)
  const [allVersions, setAllVersions] = useState(false)
  const versionList = otherVersions.map((version) => version.version ?? version.name).join(', ')

  return (
    <ConfirmDialog
      title={allVersions ? `Remove all versions of ${mod.name}?` : `Remove ${mod.name}?`}
      confirmLabel="Remove"
      onConfirm={() => onConfirm(deployed && trashLeftovers, allVersions)}
      onClose={onClose}
    >
      <p>
        {allVersions ? 'They' : 'It'} will be taken off your mod list
        {deployed ? ' and out of your game' : ''}.
      </p>
      <p className="muted">
        Your downloaded archive stays where it is, so you can import it again anytime.
      </p>

      {otherVersions.length > 0 && (
        <label className="confirm-option">
          <input
            type="checkbox"
            checked={allVersions}
            onChange={(event) => setAllVersions(event.target.checked)}
          />
          <span>
            Also remove the other {otherVersions.length === 1 ? 'version' : 'versions'}
            <span className="muted">{versionList}</span>
          </span>
        </label>
      )}

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
