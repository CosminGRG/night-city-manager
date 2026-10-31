import { useEffect, useState } from 'react'
import type { DeployStatus, Framework, ModRecord } from '@shared/types'
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from '@renderer/modLabels'
import { CoreModStatus } from './CoreModStatus'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

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

  async function refresh(): Promise<void> {
    const [statuses, frameworks] = await Promise.all([
      window.api.listDeployments(),
      window.api.getInstalledFrameworks()
    ])
    setDeployments(statuses)
    setInstalled(frameworks)
  }

  useEffect(() => {
    window.api.listMods().then(setMods)
    refresh()
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
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {mods === null && <p>Loading...</p>}
      {mods?.length === 0 && <p className="muted">No mods yet. Import an archive to start.</p>}
      <ul className="mod-list">
        {sorted?.map((mod) => (
          <ModItem
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
    </section>
  )
}

interface ModItemProps {
  mod: ModRecord
  status: DeployStatus | undefined
  installed: Framework[]
  busy: boolean
  locked: boolean
  onDeploy: (mod: ModRecord) => void
  onUndeploy: (mod: ModRecord) => void
}

function ModItem({
  mod,
  status,
  installed,
  busy,
  locked,
  onDeploy,
  onUndeploy
}: ModItemProps): React.JSX.Element {
  const interrupted = status === 'deploying' || status === 'undeploying'
  const nothingToDeploy = mod.plan.files.length === 0

  return (
    <li className={isCoreMod(mod) ? 'mod mod-core' : 'mod'}>
      <div className="mod-title">
        <span className="mod-name">{mod.name}</span>
        {mod.version && <span className="mod-version">{mod.version}</span>}
        {status === 'deployed' && <span className="badge badge-deployed">Deployed</span>}
        <span className="mod-date">{dateFormat.format(new Date(mod.importedAt))}</span>
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
      </div>
      <div className="badges">
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
      </div>
      {interrupted && (
        <p className="warning">
          The last deploy or undeploy was interrupted. Undeploy to clean up.
        </p>
      )}
      {mod.plan.warnings.map((warning) => (
        <p key={warning} className="warning">
          {warning}
        </p>
      ))}
    </li>
  )
}
