import { useEffect, useState } from 'react'
import { Circle, CircleCheck, TriangleAlert } from 'lucide-react'
import type { DeployStatus, Framework, ModRecord, Result } from '@shared/types'
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from '@renderer/modLabels'
import { CoreModStatus } from './CoreModStatus'
import { filterMods, isCoreMod, paginate, sortMods } from '@renderer/modListView'
import { Pagination } from './Pagination'
import { SearchBox } from './SearchBox'
import { ConfirmDialog } from './ConfirmDialog'
import { type ModActions, ModControls } from './ModControls'
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

export function ModList(): React.JSX.Element {
  const [mods, setMods] = useState<ModRecord[] | null>(null)
  const [deployments, setDeployments] = useState<Record<string, DeployStatus>>({})
  const [installed, setInstalled] = useState<Framework[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pendingRemoval, setPendingRemoval] = useState<ModRecord | null>(null)
  const [busy, setBusy] = useState<Busy | null>(null)

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
    loadDeployState().then(applyDeployState)
  }, [])

  async function handleImport(): Promise<void> {
    setImporting(true)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.importMod()
      if (!result) return
      if (result.ok) {
        setMods((current) => [...(current ?? []), result.value])
      } else {
        setError(result.error)
      }
    } finally {
      setImporting(false)
    }
  }

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
  const locked = importing || busy !== null

  return (
    <section className="mods">
      <CoreModStatus installed={installed} />
      <header className="mods-header">
        <div className="mods-title">
          <h2>
            Mods <span className="mods-count">{mods?.length ?? 0}</span>
          </h2>
          <button onClick={handleImport} disabled={locked}>
            {importing ? 'Importing...' : 'Import archive'}
          </button>
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
      {mods?.length === 0 && <p className="muted">No mods yet. Import an archive to start.</p>}
      {visible && mods && mods.length > 0 && visible.total === 0 && (
        <p className="muted">No mods match &quot;{query}&quot;.</p>
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
                  installed={installed}
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
  installed: Framework[]
  busyLabel: string | null
  locked: boolean
  actions: ModActions
}

function ModRow({
  mod,
  status,
  installed,
  busyLabel,
  locked,
  actions
}: ModRowProps): React.JSX.Element {
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
        {mod.plan.providers.map((framework) => {
          const isInstalled = installed.includes(framework)
          const label = isInstalled
            ? 'Installed in the game folder'
            : 'Not installed in the game folder'
          return (
            <span key={framework} className="badge badge-framework" title={label}>
              <span
                className={isInstalled ? 'dot dot-installed' : 'dot dot-missing'}
                aria-label={label}
              />
              {FRAMEWORK_LABELS[framework]}
            </span>
          )
        })}
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
