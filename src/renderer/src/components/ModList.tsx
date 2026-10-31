import { useEffect, useState } from 'react'
import { Circle, CircleCheck, TriangleAlert } from 'lucide-react'
import type { DeployStatus, Framework, ModRecord } from '@shared/types'
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from '@renderer/modLabels'
import { CoreModStatus } from './CoreModStatus'
import './ModList.css'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const INTERRUPTED = 'The last deploy or undeploy was interrupted. Undeploy to clean up.'

interface DeployState {
  deployments: Record<string, DeployStatus>
  installed: Framework[]
}

async function loadDeployState(): Promise<DeployState> {
  const [deployments, installed] = await Promise.all([
    window.api.listDeployments(),
    window.api.getInstalledFrameworks()
  ])
  return { deployments, installed }
}

function isCoreMod(mod: ModRecord): boolean {
  return mod.plan.providers.length > 0
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
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function applyDeployState(state: DeployState): void {
    setDeployments(state.deployments)
    setInstalled(state.installed)
  }

  async function refresh(): Promise<void> {
    applyDeployState(await loadDeployState())
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
    setBusyId(mod.id)
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.deployMod(mod.id)
      if (!result.ok) setError(result.error)
    } finally {
      await refresh()
      setBusyId(null)
    }
  }

  async function handleUndeploy(mod: ModRecord): Promise<void> {
    setBusyId(mod.id)
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
      setBusyId(null)
    }
  }

  const sorted = mods && [...mods].sort((a, b) => Number(isCoreMod(b)) - Number(isCoreMod(a)))
  const locked = importing || busyId !== null

  return (
    <section className="mods">
      <CoreModStatus installed={installed} />
      <header className="mods-header">
        <h2>Mods</h2>
        <button onClick={handleImport} disabled={locked}>
          {importing ? 'Importing...' : 'Import archive'}
        </button>
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
      {sorted && sorted.length > 0 && (
        <div className="mod-table">
          <div className="mod-row mod-head" aria-hidden="true">
            <span />
            <span>Name</span>
            <span>Type</span>
            <span>Imported</span>
            <span />
          </div>
          <ul className="mod-list">
            {sorted.map((mod) => (
              <ModRow
                key={mod.id}
                mod={mod}
                status={deployments[mod.id]}
                installed={installed}
                busy={busyId === mod.id}
                locked={locked}
                onDeploy={handleDeploy}
                onUndeploy={handleUndeploy}
              />
            ))}
          </ul>
        </div>
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
  busy: boolean
  locked: boolean
  onDeploy: (mod: ModRecord) => void
  onUndeploy: (mod: ModRecord) => void
}

function ModRow({
  mod,
  status,
  installed,
  busy,
  locked,
  onDeploy,
  onUndeploy
}: ModRowProps): React.JSX.Element {
  const interrupted = status === 'deploying' || status === 'undeploying'
  const nothingToDeploy = mod.plan.files.length === 0
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
        {status ? (
          <button className="small" onClick={() => onUndeploy(mod)} disabled={locked}>
            {busy ? 'Undeploying...' : 'Undeploy'}
          </button>
        ) : (
          <button
            className="small"
            onClick={() => onDeploy(mod)}
            disabled={locked || nothingToDeploy}
            title={
              nothingToDeploy ? 'This mod has no files that can be placed automatically' : undefined
            }
          >
            {busy ? 'Deploying...' : 'Deploy'}
          </button>
        )}
      </span>
    </li>
  )
}
