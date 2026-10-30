import { useEffect, useState } from 'react'
import type { Framework, ModRecord } from '@shared/types'
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from '@renderer/modLabels'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function isCoreMod(mod: ModRecord): boolean {
  return mod.plan.providers.length > 0
}

export function ModList(): React.JSX.Element {
  const [mods, setMods] = useState<ModRecord[] | null>(null)
  const [installed, setInstalled] = useState<Framework[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.listMods().then(setMods)
    window.api.getInstalledFrameworks().then(setInstalled)
  }, [])

  async function handleImport(): Promise<void> {
    setImporting(true)
    setError(null)
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

  const sorted = mods && [...mods].sort((a, b) => Number(isCoreMod(b)) - Number(isCoreMod(a)))

  return (
    <section className="mods">
      <header className="mods-header">
        <h2>Mods</h2>
        <button onClick={handleImport} disabled={importing}>
          {importing ? 'Importing...' : 'Import archive'}
        </button>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {mods === null && <p>Loading...</p>}
      {mods?.length === 0 && <p className="muted">No mods yet. Import an archive to start.</p>}
      <ul className="mod-list">
        {sorted?.map((mod) => (
          <ModItem key={mod.id} mod={mod} installed={installed} />
        ))}
      </ul>
    </section>
  )
}

function ModItem({
  mod,
  installed
}: {
  mod: ModRecord
  installed: Framework[]
}): React.JSX.Element {
  return (
    <li className={isCoreMod(mod) ? 'mod mod-core' : 'mod'}>
      <div className="mod-title">
        <span className="mod-name">{mod.name}</span>
        {mod.version && <span className="mod-version">{mod.version}</span>}
        <span className="mod-date">{dateFormat.format(new Date(mod.importedAt))}</span>
      </div>
      <div className="badges">
        {mod.plan.providers.map((framework) => {
          const isInstalled = installed.includes(framework)
          const status = isInstalled
            ? 'Installed in the game folder'
            : 'Not installed in the game folder'
          return (
            <span key={framework} className="badge badge-framework" title={status}>
              <span
                className={isInstalled ? 'dot dot-installed' : 'dot dot-missing'}
                aria-label={status}
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
      {mod.plan.warnings.map((warning) => (
        <p key={warning} className="warning">
          {warning}
        </p>
      ))}
    </li>
  )
}
