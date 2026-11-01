import {
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  LoaderCircle,
  PackagePlus,
  type LucideIcon
} from 'lucide-react'
import type { ImportItem, ImportQueue, ImportStatus } from '@renderer/useImportQueue'
import './ImportView.css'

const NEXUS_URL = 'https://www.nexusmods.com/cyberpunk2077'

const STATUS_ICONS: Record<ImportStatus, LucideIcon> = {
  queued: Clock,
  importing: LoaderCircle,
  done: CircleCheck,
  failed: CircleX
}

const STATUS_LABELS: Record<ImportStatus, string> = {
  queued: 'Waiting',
  importing: 'Importing',
  done: 'Imported',
  failed: 'Failed'
}

interface ImportViewProps {
  queue: ImportQueue
  onPick: () => void
}

function summary(items: ImportItem[], finished: number): string {
  if (items.length === 0) return 'No imports yet'

  if (finished < items.length) {
    return `Importing ${finished + 1} of ${items.length}...`
  }

  const failed = items.filter((item) => item.status === 'failed').length
  if (failed === 0) {
    return `${items.length} imported`
  }

  return `${items.length - failed} imported, ${failed} failed`
}

export function ImportView({ queue, onPick }: ImportViewProps): React.JSX.Element {
  const { items, clearFinished } = queue
  const finished = items.filter((item) => item.status === 'done' || item.status === 'failed')

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
              <ImportRow key={item.key} item={item} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function ImportRow({ item }: { item: ImportItem }): React.JSX.Element {
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
    </li>
  )
}
