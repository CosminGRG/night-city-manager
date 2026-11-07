import { useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { BulkRequest, BulkScope } from '@shared/types'
import { ConfirmDialog } from './ConfirmDialog'
import { TrashLeftoversOption } from './TrashLeftoversOption'
import type { MissingRequirements } from '@renderer/requirementsView'
import './BulkConfirmDialog.css'

const CONFIRM_WORD = 'remove'

interface DialogText {
  title: string
  body: string
  note: string
  confirmLabel: string
}

const SCOPE_LABELS: Record<BulkScope, string> = {
  all: 'all mods',
  core: 'core mods',
  'non-core': 'all but core mods'
}

function mods(count: number, kind = ''): string {
  return `${count} ${kind}${count === 1 ? 'mod' : 'mods'}`
}

function dialogText({ action, scope }: BulkRequest, count: number): DialogText {
  const target = SCOPE_LABELS[scope]

  switch (action) {
    case 'deploy':
      return {
        title: `Deploy ${target}?`,
        body: `${mods(count)} will be deployed to your game folder, core mods first.`,
        note: 'If two mods want the same file, the first one keeps it and the other is reported.',
        confirmLabel: 'Deploy'
      }
    case 'purge':
      return {
        title: `Purge ${target}?`,
        body: `${mods(count, 'deployed ')} will be taken out of your game folder.`,
        note: 'They stay in your mod list, so you can deploy them again anytime.',
        confirmLabel: 'Purge'
      }
    case 'remove':
      return {
        title: `Remove ${target}?`,
        body: `${mods(count)} will be undeployed and deleted from your mod list.`,
        note: 'Your downloaded archives stay where they are, but every mod has to be imported again.',
        confirmLabel: 'Remove'
      }
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
  const needsWord = request.action === 'remove'
  const text = dialogText(request, count)
  const [trashLeftovers, setTrashLeftovers] = useState(false)
  const canTrash = request.action !== 'deploy'

  return (
    <ConfirmDialog
      title={text.title}
      confirmLabel={text.confirmLabel}
      tone={request.action === 'deploy' ? 'primary' : 'danger'}
      confirmDisabled={needsWord && typed.trim().toLowerCase() !== CONFIRM_WORD}
      initialFocus={needsWord ? inputRef : undefined}
      onConfirm={() => onConfirm(trashLeftovers)}
      onClose={onClose}
    >
      <p>{text.body}</p>
      <p className="muted">{text.note}</p>
      {missing.length > 0 && (
        <div className="bulk-missing">
          <p className="with-icon">
            <TriangleAlert size={16} aria-hidden="true" />
            {missing.length === 1 ? '1 mod needs' : `${missing.length} mods need`} something that
            isn&apos;t installed
          </p>
          <details>
            <summary>Show mods</summary>
            <ul>
              {missing.map((entry) => (
                <li key={entry.mod.id}>
                  <strong>{entry.mod.name}</strong>: {entry.missing.join(', ')}
                </li>
              ))}
            </ul>
          </details>
          <p className="muted">They will deploy but may not work until you add these.</p>
        </div>
      )}
      {canTrash && (
        <TrashLeftoversOption
          checked={trashLeftovers}
          onChange={setTrashLeftovers}
          hint="Logs, settings and saved data (like CET key bindings or AMM appearances) in folders the app created that no deployed mod still uses."
        />
      )}

      {needsWord && (
        <label className="confirm-word">
          <span>
            Type <strong>{CONFIRM_WORD}</strong> to confirm
          </span>
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
