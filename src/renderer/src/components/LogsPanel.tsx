import { useEffect, useState } from 'react'
import { FileText, FolderOpen, RefreshCw, ScrollText, TriangleAlert, Wrench } from 'lucide-react'
import type { GameLogs, LogFile, Result } from '@shared/types'
import { EmptyState } from './EmptyState'
import { formatSize } from '@renderer/leftoversView'
import { formatWhen, groupLogs } from '@renderer/logsView'
import './LogsPanel.css'

interface LoadedLogs {
  logs: GameLogs
  at: Date
}

interface LogRowProps {
  log: LogFile
  now: Date
  onOpen: (log: LogFile) => void
  onOpenFolder: (log: LogFile) => void
}

function LogRow({ log, now, onOpen, onOpenFolder }: LogRowProps): React.JSX.Element {
  return (
    <li className="log-row">
      <button className="log-open" onClick={() => onOpen(log)} title={log.path}>
        <FileText size={16} aria-hidden="true" />
        <span className="log-title">{log.title}</span>
        <span className="muted log-meta">
          {formatWhen(log.modifiedAt, now)} · {log.size === 0 ? 'empty' : formatSize(log.size)}
        </span>
      </button>
      {log.older > 0 && <span className="muted log-older">+{log.older} older</span>}
      <button
        className="log-folder"
        onClick={() => onOpenFolder(log)}
        title="Open folder"
        aria-label={`Open the folder with all ${log.title} logs`}
      >
        <FolderOpen size={16} aria-hidden="true" />
      </button>
    </li>
  )
}

export function LogsPanel(): React.JSX.Element {
  const [loaded, setLoaded] = useState<LoadedLogs | null>(null)
  const [error, setError] = useState<string | null>(null)

  function apply(result: Result<GameLogs>): void {
    if (result.ok) {
      setLoaded({ logs: result.value, at: new Date() })
    } else {
      setError(result.error)
    }
  }

  useEffect(() => {
    window.api.listLogs().then(apply)
  }, [])

  async function refresh(): Promise<void> {
    setError(null)
    setLoaded(null)
    apply(await window.api.listLogs())
  }

  async function open(action: () => Promise<Result<null>>): Promise<void> {
    setError(null)
    const result = await action()
    if (!result.ok) {
      setError(result.error)
    }
  }

  function renderLogs({ logs }: GameLogs, now: Date): React.ReactNode {
    if (logs.length === 0) {
      return (
        <EmptyState icon={ScrollText} title="No logs yet">
          <p className="muted">
            CET, redscript and RED4ext write their logs when the game starts. Launch the game with
            your mods, then come back.
          </p>
        </EmptyState>
      )
    }

    return groupLogs(logs).map((group) => (
      <section key={group.source} className="log-group" aria-label={group.label}>
        <h4 className="log-group-title">{group.label}</h4>
        <ul className="log-list">
          {group.logs.map((log) => (
            <LogRow
              key={log.path}
              log={log}
              now={now}
              onOpen={(log) => open(() => window.api.openLog(log.path))}
              onOpenFolder={(log) => open(() => window.api.openLogFolder(log.path))}
            />
          ))}
        </ul>
      </section>
    ))
  }

  function renderCrashes({ crashReports, lastCrashAt }: GameLogs, now: Date): React.ReactNode {
    return (
      <div className="log-crashes">
        <TriangleAlert size={16} aria-hidden="true" />
        <span>
          {crashReports === 0
            ? 'No crash reports'
            : `${crashReports} crash ${crashReports === 1 ? 'report' : 'reports'}`}
          {lastCrashAt && <span className="muted"> · last {formatWhen(lastCrashAt, now)}</span>}
        </span>
        <button
          className="small with-icon"
          disabled={crashReports === 0}
          onClick={() => open(() => window.api.openCrashReports())}
        >
          <FolderOpen size={14} aria-hidden="true" />
          Open folder
        </button>
      </div>
    )
  }

  return (
    <section className="troubleshoot-panel" aria-labelledby="logs-title">
      <header className="troubleshoot-panel-header">
        <div>
          <h3 id="logs-title">Logs</h3>
          <p className="muted">
            The newest log of each framework and plugin, from your last game launch. Click one to
            open it. These are the files people ask for when you look for help.
          </p>
        </div>
        <button className="primary with-icon" onClick={refresh} disabled={!loaded && !error}>
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loaded ? (
        <>
          {renderLogs(loaded.logs, loaded.at)}
          {renderCrashes(loaded.logs, loaded.at)}
        </>
      ) : (
        !error && <p className="muted">Looking for logs...</p>
      )}

      <div className="log-app">
        <Wrench size={16} aria-hidden="true" />
        <span>
          Fixer&apos;s own log
          <span className="muted"> · send this one when something in Fixer goes wrong</span>
        </span>
        <button className="small with-icon" onClick={() => open(() => window.api.openAppLog())}>
          <FileText size={14} aria-hidden="true" />
          Open
        </button>
      </div>
    </section>
  )
}
