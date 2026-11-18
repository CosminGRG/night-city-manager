import { useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { BulkAction, BulkRequest, BulkScope } from '@shared/types'
import type { MessageKey } from '@shared/i18n/en'
import { useT } from '@renderer/i18n/context'
import { insert } from '@renderer/i18n/insert'
import { ConfirmDialog } from './ConfirmDialog'
import { TrashLeftoversOption } from './TrashLeftoversOption'
import type { MissingRequirements } from '@renderer/requirementsView'
import './BulkConfirmDialog.css'

interface DialogKeys {
  title: MessageKey
  body: MessageKey
  note: MessageKey
  confirm: MessageKey
}

const SCOPE_LABELS: Record<BulkScope, MessageKey> = {
  all: 'bulk.scope.all',
  core: 'bulk.scope.core',
  'non-core': 'bulk.scope.nonCore'
}

const DIALOG_KEYS: Record<BulkAction, DialogKeys> = {
  deploy: {
    title: 'bulk.deploy.title',
    body: 'bulk.deploy.body',
    note: 'bulk.deploy.note',
    confirm: 'bulk.deploy.confirm'
  },
  purge: {
    title: 'bulk.purge.title',
    body: 'bulk.purge.body',
    note: 'bulk.purge.note',
    confirm: 'bulk.purge.confirm'
  },
  remove: {
    title: 'bulk.remove.title',
    body: 'bulk.remove.body',
    note: 'bulk.remove.note',
    confirm: 'common.remove'
  }
}

interface BulkConfirmDialogProps {
  request: BulkRequest
  count: number
  missing: MissingRequirements[]
  onConfirm: (trashLeftovers: boolean) => void
  onClose: () => void
}

export function BulkConfirmDialog({
  request,
  count,
  missing,
  onConfirm,
  onClose
}: BulkConfirmDialogProps): React.JSX.Element {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [trashLeftovers, setTrashLeftovers] = useState(false)
  const t = useT()
  const keys = DIALOG_KEYS[request.action]
  const confirmWord = t('bulk.confirmWord')
  const needsWord = request.action === 'remove'
  const canTrash = request.action !== 'deploy'

  return (
    <ConfirmDialog
      title={t(keys.title, { target: t(SCOPE_LABELS[request.scope]) })}
      confirmLabel={t(keys.confirm)}
      tone={request.action === 'deploy' ? 'primary' : 'danger'}
      confirmDisabled={needsWord && typed.trim().toLowerCase() !== confirmWord.toLowerCase()}
      initialFocus={needsWord ? inputRef : undefined}
      onConfirm={() => onConfirm(trashLeftovers)}
      onClose={onClose}
    >
      <p>{t(keys.body, { count })}</p>
      <p className="muted">{t(keys.note)}</p>
      {missing.length > 0 && (
        <div className="bulk-missing">
          <p className="with-icon">
            <TriangleAlert size={16} aria-hidden="true" />
            {t('bulk.missing', { count: missing.length })}
          </p>
          <details>
            <summary>{t('bulk.showMods')}</summary>
            <ul>
              {missing.map((entry) => (
                <li key={entry.mod.id}>
                  <strong>{entry.mod.name}</strong>: {entry.missing.join(', ')}
                </li>
              ))}
            </ul>
          </details>
          <p className="muted">{t('bulk.missingNote')}</p>
        </div>
      )}
      {canTrash && (
        <TrashLeftoversOption
          checked={trashLeftovers}
          onChange={setTrashLeftovers}
          hint={t('bulk.trashHint')}
        />
      )}

      {needsWord && (
        <label className="confirm-word">
          <span>{insert(t('bulk.typeToConfirm'), { word: <strong>{confirmWord}</strong> })}</span>
          <input
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
      )}
    </ConfirmDialog>
  )
}
