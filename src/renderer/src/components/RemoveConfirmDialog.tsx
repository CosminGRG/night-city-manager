import { useState } from 'react'
import type { ModRecord } from '@shared/types'
import type { MessageKey } from '@shared/i18n/en'
import { useT } from '@renderer/i18n/context'
import { ConfirmDialog } from './ConfirmDialog'
import { TrashLeftoversOption } from './TrashLeftoversOption'

interface RemoveConfirmDialogProps {
  mod: ModRecord
  otherVersions: ModRecord[]
  deployed: boolean
  onConfirm: (trashLeftovers: boolean, allVersions: boolean) => void
  onClose: () => void
}

function bodyKey(allVersions: boolean, deployed: boolean): MessageKey {
  if (allVersions) return deployed ? 'remove.body.allDeployed' : 'remove.body.all'
  return deployed ? 'remove.body.oneDeployed' : 'remove.body.one'
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
  const t = useT()
  const versionList = otherVersions.map((version) => version.version ?? version.name).join(', ')

  return (
    <ConfirmDialog
      title={t(allVersions ? 'remove.titleAll' : 'remove.title', { name: mod.name })}
      confirmLabel={t('common.remove')}
      onConfirm={() => onConfirm(deployed && trashLeftovers, allVersions)}
      onClose={onClose}
    >
      <p>{t(bodyKey(allVersions, deployed))}</p>
      <p className="muted">{t('remove.archiveNote')}</p>

      {otherVersions.length > 0 && (
        <label className="confirm-option">
          <input
            type="checkbox"
            checked={allVersions}
            onChange={(event) => setAllVersions(event.target.checked)}
          />
          <span>
            {t('remove.otherVersions', { count: otherVersions.length })}
            <span className="muted">{versionList}</span>
          </span>
        </label>
      )}

      {deployed && (
        <TrashLeftoversOption
          checked={trashLeftovers}
          onChange={setTrashLeftovers}
          hint={t('remove.trashHint')}
        />
      )}
    </ConfirmDialog>
  )
}
