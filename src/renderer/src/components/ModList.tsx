import { useEffect, useState } from 'react'
import type { ModRecord } from '@shared/types'
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from '@renderer/modLabels'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function ModList(): React.JSX.Element {
  const [mods, setMods] = useState<ModRecord[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.listMods().then(setMods)
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
        {mods?.map((mod) => (
          <ModItem key={mod.id} mod={mod} />
        ))}
      </ul>
    </section>
  )

  function ModItem({ mod }: { mod: ModRecord }): React.JSX.Element {
    return (
      <li className="mod">
        <div className="mod-title">
          <span className="mod-name">{mod.name}</span>
          {mod.version && <span className="mod-version">{mod.version}</span>}
          <span className="mod-date">{dateFormat.format(new Date(mod.importedAt))}</span>
        </div>
        <div className="badges">
          {mod.plan.providers.map((framework) => (
            <span key={framework} className="badge badge-framework">
              {FRAMEWORK_LABELS[framework]}
            </span>
          ))}
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
}
