import { useEffect, useState } from 'react'
import { RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import type { LeftoverGroup, Result } from '@shared/types'
import { ConfirmDialog } from './ConfirmDialog'
import { EmptyState } from './EmptyState'
import {
  cleanedMessage,
  defaultSelection,
  formatSize,
  selectedTotals,
  toggleFiles
} from '@renderer/leftoversView'
import './LeftoversPanel.css'

interface LeftoverGroupRowProps {
  group: LeftoverGroup
  selected: Set<string>
  onToggle: (paths: string[], on: boolean) => void
}

function LeftoverGroupRow({ group, selected, onToggle }: LeftoverGroupRowProps): React.JSX.Element {
  const paths = group.files.map((file) => file.path)
  const count = paths.filter((path) => selected.has(path)).length
  const size = group.files.reduce((sum, file) => sum + file.size, 0)

  return (
    <li className="leftover-group">
      <details>
        <summary>
          <input
            type="checkbox"
            checked={count === paths.length}
            ref={(box) => {
              if (box) box.indeterminate = count > 0 && count < paths.length
            }}
            onChange={(event) => onToggle(paths, event.target.checked)}
            aria-label={`Select all files in ${group.folder}`}
          />
          <span className="leftover-folder">{group.folder}</span>
          {group.inUse && (
            <span
              className="leftover-badge"
              title="A deployed mod still has files in this folder, so these may be its live settings."
            >
              In use
            </span>
          )}
          <span className="muted leftover-size">
            {group.files.length} {group.files.length === 1 ? 'file' : 'files'} · {formatSize(size)}
          </span>
        </summary>
        <ul className="leftover-files">
          {group.files.map((file) => (
            <li key={file.path}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(file.path)}
                  onChange={(event) => onToggle([file.path], event.target.checked)}
                />
                <span className="leftover-path">{file.path.slice(group.folder.length + 1)}</span>
                {file.changed && (
                  <span
                    className="leftover-badge"
                    title="A mod file that changed after it was deplyed, for example saved mod data."
                  >
                    Changed
                  </span>
                )}
                <span className="muted leftover-size">{formatSize(file.size)}</span>
              </label>
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

export function LeftoversPanel(): React.JSX.Element {
  const [groups, setGroups] = useState<LeftoverGroup[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [locked, setLocked] = useState(false)

  function applyScan(result: Result<LeftoverGroup[]>): void {
    if (result.ok) {
      setGroups(result.value)
      setSelected(defaultSelection(result.value))
    } else {
      setError(result.error)
    }
  }

  useEffect(() => {
    window.api.scanLeftovers().then(applyScan)
    window.api.getBisect().then((result) => setLocked(result.ok && result.value !== null))
  }, [])

  async function rescan(): Promise<void> {
    setGroups(null)
    applyScan(await window.api.scanLeftovers())
  }

  function handleRescan(): void {
    setError(null)
    setNotice(null)
    rescan()
  }

  async function handleClean(): Promise<void> {
    setCleaning(true)
    setError(null)
    setNotice(null)

    try {
      const result = await window.api.cleanLeftovers([...selected])
      if (result.ok) {
        setNotice(cleanedMessage(result.value))
      } else {
        setError(result.error)
      }
    } finally {
      setCleaning(false)
      await rescan()
    }
  }

  function toggle(paths: string[], on: boolean): void {
    setSelected((current) => toggleFiles(current, paths, on))
  }

  const totals = groups ? selectedTotals(groups, selected) : { count: 0, size: 0 }
  const fileCount = groups ? groups.reduce((sum, group) => sum + group.files.length, 0) : 0

  function renderBody(): React.ReactNode {
    if (!groups) return error ? null : <p className="muted">Scanning...</p>
    if (groups.length === 0) {
      return (
        <EmptyState icon={Sparkles} title="No leftover files">
          <p className="muted">
            Folders the app created in your game hold only files from deployed mods.
          </p>
        </EmptyState>
      )
    }

    return (
      <>
        <ul className="leftover-groups">
          {groups.map((group) => (
            <LeftoverGroupRow
              key={group.folder}
              group={group}
              selected={selected}
              onToggle={toggle}
            />
          ))}
        </ul>
        {locked && (
          <p className="warning">
            Finish the bisect first: mods switched off for a round keep their settings here.
          </p>
        )}
        <div className="leftover-actions">
          <span className="muted">
            {totals.count} of {fileCount} files selected ({formatSize(totals.size)})
          </span>
          <button
            className="danger with-icon"
            disabled={totals.count === 0 || cleaning || locked}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={16} aria-hidden="true" />
            Move to Recycle Bin
          </button>
        </div>
      </>
    )
  }
  return (
    <section className="troubleshoot-panel" aria-labelledby="leftovers-title">
      <header className="troubleshoot-panel-header">
        <div>
          <h3 id="leftovers-title">Leftover files</h3>
          <p className="muted">
            Settings, logs and saved mod data that mods wrote into folders the app created.
            Undeploying keeps them, so a redeployed mod keeps its settings.
          </p>
          <p className="notice" role="status">
            {notice}
          </p>
        </div>
        <button className="primary with-icon" onClick={handleRescan} disabled={!groups || cleaning}>
          <RefreshCw size={16} aria-hidden="true" />
          Scan again
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {renderBody()}
      {confirming && (
        <ConfirmDialog
          title={`Move ${totals.count} ${totals.count === 1 ? 'file' : 'files'} to the Recycle Bin?`}
          confirmLabel="Move to Recycle Bin"
          onConfirm={handleClean}
          onClose={() => setConfirming(false)}
        >
          <p>Mods lose what these files hold, for example CET key binds or AMM appearances.</p>
          <p className="muted">You can restore them from the Recycle Bin.</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
