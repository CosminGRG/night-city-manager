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
import type { MessageKey } from '@shared/i18n/en'
import type { Translate } from '@shared/i18n/translate'
import type { LinkOption } from '@renderer/versionsView'
import { useI18n, useT } from '@renderer/i18n/context'
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

const STATUS_LABELS: Record<ImportStatus, MessageKey> = {
  queued: 'import.status.queued',
  importing: 'import.status.importing',
  done: 'import.status.done',
  duplicate: 'import.status.duplicate',
  failed: 'import.status.failed'
}

interface ImportViewProps {
  queue: ImportQueue
  onPick: () => void
}

interface ImportRowProps {
  item: ImportItem
  onAskVersion: () => void
}

function summary(items: ImportItem[], finished: number, t: Translate, language: string): string {
  if (items.length === 0) {
    return t('import.noneYet')
  }

  if (finished < items.length) {
    return t('import.progress', { current: finished + 1, total: items.length })
  }

  const count = (status: ImportStatus): number =>
    items.filter((item) => item.status === status).length
  const parts = [t('import.summary.imported', { count: count('done') })]
  if (count('duplicate') > 0) {
    parts.push(t('import.summary.duplicate', { count: count('duplicate') }))
  }
  if (count('failed') > 0) {
    parts.push(t('import.summary.failed', { count: count('failed') }))
  }

  return new Intl.ListFormat(language, { type: 'unit' }).format(parts)
}

export function ImportView({ queue, onPick }: ImportViewProps): React.JSX.Element {
  const { items, clearFinished, noteVersion } = queue
  const finished = items.filter(isFinished)
  const [linking, setLinking] = useState<ImportItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { t, language } = useI18n()

  async function handleLink(item: ImportItem, target: LinkOption | null): Promise<void> {
    if (!item.mod) {
      return
    }

    setError(null)
    const result = await window.api.setVersionOf(item.mod.id, target?.id ?? null)
    if (!result.ok) {
      setError(result.error)
    } else {
      noteVersion(item.key, target ? { kind: 'version', of: target.name } : { kind: 'separate' })
    }
  }

  return (
    <section className="import">
      <h2>{t('import.title')}</h2>

      <div className="drop-zone">
        <PackagePlus size={36} aria-hidden="true" />
        <p className="drop-zone-title">{t('import.dropTitle')}</p>
        <p className="muted">.zip, .7z, .rar</p>
        <button className="primary" onClick={onPick}>
          {t('import.choose')}
        </button>
      </div>

      <a className="button-link nexus-button" href={NEXUS_URL} target="_blank" rel="noreferrer">
        <ExternalLink size={14} aria-hidden="true" />
        {t('import.getMore')}
      </a>

      <div className="import-results">
        <header className="import-results-header">
          <p aria-live="polite">{summary(items, finished.length, t, language)}</p>
          <button className="small" onClick={clearFinished} disabled={finished.length === 0}>
            {t('import.clearFinished')}
          </button>
        </header>
        {items.length === 0 ? (
          <p className="import-empty muted">{t('import.empty')}</p>
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
  return item.status === 'done' && item.mod?.nexusModId === null && item.answer === null
}

function ImportRow({ item, onAskVersion }: ImportRowProps): React.JSX.Element {
  const t = useT()
  const Icon = STATUS_ICONS[item.status]
  const label = t(STATUS_LABELS[item.status])

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
      {item.status === 'duplicate' && item.mod && (
        <span className="import-message">{t('import.duplicateOf', { name: item.mod.name })}</span>
      )}
      {asksVersion(item) && (
        <span className="import-question">
          {t('import.question')}
          <button className="small" onClick={onAskVersion}>
            {t('import.answer')}
          </button>
        </span>
      )}
      {item.answer && (
        <span className="import-message">
          {item.answer.kind === 'version'
            ? t('import.versionOf', { name: item.answer.of })
            : t('import.separate')}
        </span>
      )}
    </li>
  )
}
