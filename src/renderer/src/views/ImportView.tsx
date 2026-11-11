import { useState } from 'react'
import {
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  LoaderCircle,
  PackagePlus,
  CopyCheck,
  type LucideIcon
} from 'lucide-react'
import {
  isFinished,
  type ImportItem,
  type ImportQueue,
  type ImportStatus
} from '@renderer/useImportQueue'
import type { LinkOption } from '@renderer/versionsView'
import { VersionLinkDialog } from '@renderer/components/VersionLinkDialog'
import './ImportView.css'

const NEXUS_URL = 'https://www.nexusmods.com/cyberpunk2077'

const STATUS_ICONS: Record<ImportStatus, LucideIcon> = {
  queued: Clock,
  importing: LoaderCircle,
  done: CircleCheck,
  duplicate: CopyCheck,
  failed: CircleX
}

const STATUS_LABELS: Record<ImportStatus, string> = {
  queued: 'Waiting',
  importing: 'Importing',
  done: 'Imported',
  duplicate: 'Already in your library',
  failed: 'Failed'
}

interface ImportViewProps {
  queue: ImportQueue
  onPick: () => void
}

interface ImportRowProps {
  item: ImportItem
  onAskVersion: () => void
}

function summary(items: ImportItem[], finished: number): string {
  if (items.length === 0) return 'No imports yet'

  if (finished < items.length) {
    return `Importing ${finished + 1} of ${items.length}...`
  }

  const count = (status: ImportStatus): number =>
    items.filter((item) => item.status === status).length
  const parts = [`${count('done')} imported`]
  if (count('duplicate') > 0) parts.push(`${count('duplicate')} already in your library`)
  if (count('failed') > 0) parts.push(`${count('failed')} failed`)

  return parts.join(', ')
}

export function ImportView({ queue, onPick }: ImportViewProps): React.JSX.Element {
  const { items, clearFinished, noteVersion } = queue
  const finished = items.filter(isFinished)
  const [linking, setLinking] = useState<ImportItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleLink(item: ImportItem, target: LinkOption | null): Promise<void> {
    if (!item.mod) {
      return
    }

    setError(null)
    const result = await window.api.setVersionOf(item.mod.id, target?.id ?? null)
    if (!result.ok) {
      setError(result.error)
    } else {
      noteVersion(item.key, target ? `Version of ${target.name}` : `Separate mod`)
    }
  }

  return (
    <section className="import">
      <h2>Import mods</h2>

      <div className="drop-zone">
        <PackagePlus size={36} aria-hidden="true" />
        <p className="drop-zone-title">Drag mod archives anywhere into the window</p>
        <p className="muted">.zip, .7z, .rar</p>
        <button className="primary" onClick={onPick}>
          Choose archives
        </button>
      </div>

      <a className="button-link nexus-button" href={NEXUS_URL} target="_blank" rel="noreferrer">
        <ExternalLink size={14} aria-hidden="true" />
        Get more mods on Nexus Mods
      </a>

      <div className="import-results">
        <header className="import-results-header">
          <p aria-live="polite">{summary(items, finished.length)}</p>
          <button className="small" onClick={clearFinished} disabled={finished.length === 0}>
            Clear finished
          </button>
        </header>
        {items.length === 0 ? (
          <p className="import-empty muted">Archives you import will show up here.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <ImportRow key={item.key} item={item} onAskVersion={() => setLinking(item)} />
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {linking?.mod && (
        <VersionLinkDialog
          mod={linking.mod}
          onSave={(target) => handleLink(linking, target)}
          onClose={() => setLinking(null)}
        />
      )}
    </section>
  )
}

function asksVersion(item: ImportItem): boolean {
  return item.status === 'done' && item.mod?.nexusModId === null && item.versionNote === null
}

function ImportRow({ item, onAskVersion }: ImportRowProps): React.JSX.Element {
  const Icon = STATUS_ICONS[item.status]
  const label = STATUS_LABELS[item.status]

  return (
    <li className={`import-row ${item.status}`}>
      <span className="import-icon" role="img" aria-label={label} title={label}>
        <Icon
          size={16}
          aria-hidden="true"
          className={item.status === 'importing' ? 'spin' : undefined}
        />
      </span>
      <span className="import-name" title={item.path}>
        {item.name}
      </span>
      {item.message && <span className="import-message">{item.message}</span>}
      {asksVersion(item) && (
        <span className="import-question">
          Its name doesn&apos;t say which mod it is. Is it a new version of a mod you have?
          <button className="small" onClick={onAskVersion}>
            Choose...
          </button>
        </span>
      )}
      {item.versionNote && <span className="import-message">{item.versionNote}</span>}
    </li>
  )
}
