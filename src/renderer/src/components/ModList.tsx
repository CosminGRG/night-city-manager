import { useEffect, useState } from 'react'
import { Circle, CircleCheck, TriangleAlert, PackageOpen, SearchX } from 'lucide-react'
import type {
  DeployStatus,
  Framework,
  ModRecord,
  Result,
  BulkAction,
  BulkRequest,
  BulkResult
} from '@shared/types'
import { isCoreMod } from '@shared/mods'
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from '@renderer/modLabels'
import { CoreModStatus } from './CoreModStatus'
import { filterMods, paginate, sortMods, bulkCounts } from '@renderer/modListView'
import { Pagination } from './Pagination'
import { SearchBox } from './SearchBox'
import { ConfirmDialog } from './ConfirmDialog'
import { type ModActions, ModControls } from './ModControls'
import { ActionsMenu } from './ActionsMenu'
import { BulkConfirmDialog } from './BulkConfirmDialog'
import { EmptyState } from './EmptyState'
import './ModList.css'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const INTERRUPTED = 'The last deploy or undeploy was interrupted. Undeploy to clean up.'

interface DeployState {
  deployments: Record<string, DeployStatus>
  installed: Framework[]
}

interface Busy {
  id: string
  label: string
}

interface ModListProps {
  importedCount: number
  onImport: () => void
}

const BULK_BUSY: Record<BulkAction, string> = {
  deploy: 'Deploying...',
  purge: 'Purging...',
  remove: 'Removing...'
}

const BULK_DONE: Record<BulkAction, string> = {
  deploy: 'Deployed',
  purge: 'Purged',
  remove: 'Removed'
}

async function loadDeployState(): Promise<DeployState> {
  const [deployments, installed] = await Promise.all([
    window.api.listDeployments(),
    window.api.getInstalledFrameworks()
  ])
  return { deployments, installed }
}

function keptMessage(mod: ModRecord, kept: string[]): string {
  const files = kept.join(', ')
  if (kept.length === mod.plan.files.length) {
    return `${mod.name}: none of its files could be verified, so all were left in place (was its folder in "mods" deleted?): ${files}`
  }
  return `${mod.name}: left in place because they changed after deploy: ${files}`
}

function bulkMessage(action: BulkAction, { done, skipped, kept }: BulkResult): string {
  const parts = [`${BULK_DONE[action]} ${done} ${done === 1 ? 'mod' : 'mods'}.`]

  if (skipped > 0) {
    parts.push(
      `Skipped ${skipped} that can't be deployed automatically (nothing to place or and interrupted deploy, needs undeploy first).`
    )
  }
  if (kept.length > 0) {
    const files = kept.map(({ name, files }) => `${name}: ${files.join(', ')}`).join(', ')
    parts.push(`Left in place because they changed after deploy: ${files}`)
  }

  return parts.join(' ')
}

export function ModList({ importedCount, onImport }: ModListProps): React.JSX.Element {
  const [mods, setMods] = useState<ModRecord[] | null>(null)
  const [deployments, setDeployments] = useState<Record<string, DeployStatus>>({})
  const [installed, setInstalled] = useState<Framework[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pendingRemoval, setPendingRemoval] = useState<ModRecord | null>(null)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [pendingBulk, setPendingBulk] = useState<BulkRequest | null>(null)
  const [bulkLabel, setBulkLabel] = useState<string | null>(null)

  function applyDeployState(state: DeployState): void {
    setDeployments(state.deployments)
    setInstalled(state.installed)
  }

  async function refresh(): Promise<void> {
    applyDeployState(await loadDeployState())
  }

  function handleSearch(value: string): void {
    setQuery(value)
    setPage(1)
  }

  useEffect(() => {
    window.api.listMods().then(setMods)
  }, [importedCount])

  useEffect(() => {
    loadDeployState().then(applyDeployState)
  }, [])

  async function handleDeploy(mod: ModRecord): Promise<void> {
    setBusy({ id: mod.id, label: 'Deploying...' })
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.deployMod(mod.id)
      if (!result.ok) setError(result.error)
    } finally {
      await refresh()
      setBusy(null)
    }
  }

  async function handleUndeploy(mod: ModRecord): Promise<void> {
    setBusy({ id: mod.id, label: 'Undeploying...' })
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.undeployMod(mod.id)
      if (!result.ok) {
        setError(result.error)
      } else if (result.value.kept.length > 0) {
        setNotice(keptMessage(mod, result.value.kept))
      }
    } finally {
      await refresh()
      setBusy(null)
    }
  }

  async function handleRemove(mod: ModRecord): Promise<void> {
    setBusy({ id: mod.id, label: 'Removing...' })
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.removeMod(mod.id)
      if (!result.ok) {
        setError(result.error)
      } else if (result.value.kept.length > 0) {
        setNotice(keptMessage(mod, result.value.kept))
      }
    } finally {
      setMods(await window.api.listMods())
      await refresh()
      setBusy(null)
    }
  }

  async function handleBulk(request: BulkRequest): Promise<void> {
    setBulkLabel(BULK_BUSY[request.action])
    setError(null)
    setNotice(null)

    try {
      const result = await window.api.runBulk(request)
      if (!result.ok) {
        setError(result.error)
        return
      }

      const { failed } = result.value
      if (failed.length > 0) {
        setError(`Failed ${failed.map(({ name, error }) => `${name} (${error})`).join(',')}`)
      }
      setNotice(bulkMessage(request.action, result.value))
    } finally {
      setMods(await window.api.listMods())
      await refresh()
      setBulkLabel(null)
    }
  }

  async function showFailure(action: Promise<Result<null>>): Promise<void> {
    const result = await action
    if (!result.ok) setError(result.error)
  }

  const actions: ModActions = {
    deploy: handleDeploy,
    undeploy: handleUndeploy,
    remove: setPendingRemoval,
    reveal: (mod) => showFailure(window.api.revealMod(mod.id)),
    openNexus: (mod) => showFailure(window.api.openNexusPage(mod.id))
  }

  const visible = mods && paginate(filterMods(sortMods(mods), query), page)
  const locked = busy !== null || bulkLabel !== null
  const counts = bulkCounts(mods ?? [], deployments)
  const statuses = (mods ?? []).map((mod) => deployments[mod.id])
  const activeCount = statuses.filter((status) => status === 'deployed').length
  const interrupedCount = statuses.filter(
    (status) => status === 'deploying' || status === 'undeploying'
  ).length

  return (
    <section className="mods">
      <CoreModStatus installed={installed} />
      <header className="mods-header">
        <div className="mods-title">
          <div className="mods-heading">
            <h2>
              Mods <span className="mods-count">{mods?.length ?? 0}</span>
            </h2>
            <span
              className={activeCount > 0 ? 'stat-chip' : 'stat-chip idle'}
              title="Deployed to your game folder"
            >
              <span className="stat-dot" aria-hidden="true" />
              {activeCount} active
            </span>
            {interrupedCount > 0 && (
              <span
                className="stat-chip interrupted"
                title="A deploy or undeploy was interrupted. Undeploy these mods to clean up."
              >
                <TriangleAlert size={12} aria-hidden="true" />
                {interrupedCount} interrupted
              </span>
            )}
          </div>
          <button onClick={onImport} disabled={locked}>
            Import archives
          </button>
          <ActionsMenu
            counts={counts}
            busyLabel={bulkLabel}
            locked={locked}
            onSelect={setPendingBulk}
          />
        </div>
        <SearchBox value={query} onChange={handleSearch} />
      </header>

      {error && (
        <p role="alert" className="error mods-message">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice mods-message">
          {notice}
        </p>
      )}
      {mods === null && <p className="muted">Loading...</p>}
      {mods?.length === 0 && (
        <EmptyState icon={PackageOpen} title="No mods yet">
          <p>Drag mod archives anywhere into the window, or pick them from your disk.</p>
          <button className="primary" onClick={onImport}>
            Import archives
          </button>
        </EmptyState>
      )}
      {visible && mods && mods.length > 0 && visible.total === 0 && (
        <EmptyState icon={SearchX} title={`No mods match "${query}"`}>
          <button onClick={() => handleSearch('')}>Clear search</button>
        </EmptyState>
      )}

      {visible && visible.total > 0 && (
        <>
          <div className="mod-table">
            <div className="mod-row mod-head" aria-hidden="true">
              <span />
              <span>Name</span>
              <span>Type</span>
              <span>Imported</span>
              <span />
            </div>
            <ul className="mod-list">
              {visible.items.map((mod) => (
                <ModRow
                  key={mod.id}
                  mod={mod}
                  status={deployments[mod.id]}
                  busyLabel={busy?.id === mod.id ? busy.label : null}
                  locked={locked}
                  actions={actions}
                />
              ))}
            </ul>
          </div>
          <footer className="mods-footer">
            <span className="muted">
              {visible.first}–{visible.last} of {visible.total}
            </span>
            {visible.pageCount > 1 && (
              <Pagination page={visible.page} pageCount={visible.pageCount} onChange={setPage} />
            )}
          </footer>
        </>
      )}
      {pendingRemoval && (
        <ConfirmDialog
          title={`Remove ${pendingRemoval.name}?`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(pendingRemoval)}
          onClose={() => setPendingRemoval(null)}
        >
          <p>
            It will be taken off your mod list
            {deployments[pendingRemoval.id] ? ' and out of your game' : ''}.
          </p>
          <p className="muted">
            Your downloaded archive stays where it is, so you can import it again anytime.
          </p>
        </ConfirmDialog>
      )}

      {pendingBulk && (
        <BulkConfirmDialog
          request={pendingBulk}
          count={counts[pendingBulk.action][pendingBulk.scope]}
          onConfirm={() => handleBulk(pendingBulk)}
          onClose={() => setPendingBulk(null)}
        />
      )}
    </section>
  )
}

function StatusIcon({ status }: { status: DeployStatus | undefined }): React.JSX.Element {
  if (status === 'deployed') {
    return (
      <span className="status status-deployed" role="img" aria-label="Deployed" title="Deployed">
        <CircleCheck size={16} aria-hidden="true" />
      </span>
    )
  }
  if (status) {
    return (
      <span
        className="status status-interrupted"
        role="img"
        aria-label="Interrupted"
        title="Interrupted"
      >
        <TriangleAlert size={16} aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className="status status-idle" role="img" aria-label="Not deployed" title="Not deployed">
      <Circle size={16} aria-hidden="true" />
    </span>
  )
}

interface ModRowProps {
  mod: ModRecord
  status: DeployStatus | undefined
  busyLabel: string | null
  locked: boolean
  actions: ModActions
}

function ModRow({ mod, status, busyLabel, locked, actions }: ModRowProps): React.JSX.Element {
  const interrupted = status === 'deploying' || status === 'undeploying'
  const warnings = interrupted ? [INTERRUPTED, ...mod.plan.warnings] : mod.plan.warnings

  return (
    <li className={isCoreMod(mod) ? 'mod-row core' : 'mod-row'}>
      <span className="mod-cell mod-status">
        <StatusIcon status={status} />
      </span>

      <span className="mod-cell">
        <span className="mod-name" title={mod.name}>
          {mod.name}
        </span>
        {mod.version && <span className="mod-version">{mod.version}</span>}
        {warnings.length > 0 && (
          <span
            className="mod-warning"
            role="img"
            aria-label={warnings.join(' ')}
            title={warnings.join('\n')}
          >
            <TriangleAlert size={14} aria-hidden="true" />
          </span>
        )}
      </span>

      <span className="mod-cell mod-badges">
        {isCoreMod(mod) && (
          <span
            className="badge badge-core"
            title={`Core mod: ${mod.plan.providers.map((framework) => FRAMEWORK_LABELS[framework]).join(', ')}`}
          >
            Core
          </span>
        )}
        {mod.plan.types.map((type) => (
          <span key={type} className={`badge badge-${type}`}>
            {MOD_TYPE_LABELS[type]}
          </span>
        ))}
      </span>

      <span className="mod-cell mod-date">{dateFormat.format(new Date(mod.importedAt))}</span>

      <span className="mod-cell mod-actions">
        <ModControls
          mod={mod}
          status={status}
          busyLabel={busyLabel}
          locked={locked}
          actions={actions}
        />
      </span>
    </li>
  )
}
