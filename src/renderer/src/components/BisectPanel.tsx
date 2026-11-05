import { useEffect, useState } from 'react'
import { CircleCheck, CircleX, Play, RotateCcw, Undo2 } from 'lucide-react'
import type { BisectAnswer, BisectView, DeployStatus, ModRecord, Result } from '@shared/types'
import {
  bisectCandidates,
  defaultSuspects,
  namesOf,
  roundCount,
  roundSummary
} from '@renderer/bisectView'
import { toggleFiles } from '@renderer/leftoversView'
import { ConfirmDialog } from './ConfirmDialog'
import './BisectPanel.css'

interface BisectState {
  view: Result<BisectView | null>
  mods: ModRecord[]
  deployments: Record<string, DeployStatus>
}

async function loadBisectState(): Promise<BisectState> {
  const [view, mods, deployments] = await Promise.all([
    window.api.getBisect(),
    window.api.listMods(),
    window.api.listDeployments()
  ])
  return { view, mods, deployments }
}

interface ModNamesProps {
  title: string
  names: string[]
}

function ModNames({ title, names }: ModNamesProps): React.JSX.Element {
  return (
    <details className="bisect-names">
      <summary>
        {title} ({names.length})
      </summary>
      <ul>
        {names.map((name, index) => (
          <li key={index}>{name}</li>
        ))}
      </ul>
    </details>
  )
}

export function BisectPanel(): React.JSX.Element {
  const [view, setView] = useState<BisectView | null | undefined>(undefined)
  const [mods, setMods] = useState<ModRecord[]>([])
  const [candidates, setCandidates] = useState<ModRecord[]>([])
  const [suspects, setSuspects] = useState<Set<string>>(new Set())
  const [checkFirst, setCheckFirst] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingStop, setConfirmingStop] = useState(false)

  function apply(state: BisectState): void {
    const offered = bisectCandidates(state.mods, state.deployments)
    setMods(state.mods)
    setCandidates(offered)
    setSuspects(defaultSuspects(offered))

    if (state.view.ok) {
      setView(state.view.value)
    } else {
      setError(state.view.error)
    }
  }

  useEffect(() => {
    loadBisectState().then(apply)
  }, [])

  async function run(label: string, action: () => Promise<Result<unknown>>): Promise<void> {
    setBusy(label)
    setError(null)

    try {
      const result = await action()
      if (!result.ok) {
        setError(result.error)
      }
    } finally {
      apply(await loadBisectState())
      setBusy(null)
    }
  }

  function start(): void {
    const ordered = candidates.filter((mod) => suspects.has(mod.id)).map((mod) => mod.id)
    run('Switching mods...', () => window.api.startBisect(ordered, checkFirst))
  }

  function answer(value: BisectAnswer): void {
    run('Switching mods...', () => window.api.answerBisect(value))
  }

  function undo(): void {
    run('Switching mods...', () => window.api.undoBisect())
  }

  function end(keepCulpritOff: boolean): void {
    run('Switching mods back on...', () => window.api.endBisect(keepCulpritOff))
  }

  const locked = busy !== null

  function renderSetup(): React.ReactNode {
    if (candidates.length < 2) {
      return (
        <p className="muted">
          Deploy at least two mods besides the core mods, then come back to find the one that breaks
          your game.
        </p>
      )
    }

    const rounds = roundCount(suspects.size, checkFirst)

    return (
      <>
        <p className="muted">
          Untick mods that should stay on the whole time, for example ones that other mods need.
          Core mods always stay on.
        </p>
        <ul className="bisect-candidates">
          {candidates.map((mod) => (
            <li key={mod.id}>
              <label>
                <input
                  type="checkbox"
                  checked={suspects.has(mod.id)}
                  onChange={(event) =>
                    setSuspects((current) => toggleFiles(current, [mod.id], event.target.checked))
                  }
                />
                <span className="bisect-mod-name">{mod.name}</span>
                {!suspects.has(mod.id) && <span className="muted bisect-kept">Always on</span>}
              </label>
            </li>
          ))}
        </ul>
        <label className="bisect-option">
          <input
            type="checkbox"
            checked={checkFirst}
            onChange={(event) => setCheckFirst(event.target.checked)}
          />
          <span>
            Start with every tested mod off
            <span className="muted">
              {' '}
              (recommended: proves the problem comes from these mods at all)
            </span>
          </span>
        </label>
        <div className="bisect-actions">
          <span className="muted">
            {suspects.size} of {candidates.length} mods tested
            {rounds > 0 && `, about ${rounds} game ${rounds === 1 ? 'launch' : 'launches'}`}
          </span>
          <button
            className="primary with-icon"
            disabled={suspects.size < 2 || locked}
            onClick={start}
          >
            <Play size={16} aria-hidden="true" />
            Start Bisect
          </button>
        </div>
      </>
    )
  }

  function renderSession(session: BisectView): React.ReactNode {
    const { status } = session
    const undoButton = (
      <button className="with-icon" disabled={session.answered === 0 || locked} onClick={undo}>
        <Undo2 size={16} aria-hidden="true" />
        Undo last answer
      </button>
    )

    if (status.kind === 'found') {
      return (
        <>
          <p className="bisect-result">
            Found it: <strong>{namesOf([status.culprit], mods)[0]}</strong>
          </p>
          <p className="muted">
            The problem follows this mod. Check its Nexus page for a newer version or for
            requirements you might be missing
          </p>
          <div className="bisect-actions">
            {undoButton}
            <div className="bisect-buttons">
              <button disabled={locked} onClick={() => end(false)}>
                Switch everything back on
              </button>
              <button className="primary" disabled={locked} onClick={() => end(true)}>
                Keep it off, switch the rest on
              </button>
            </div>
          </div>
        </>
      )
    }

    if (status.kind === 'not-in-suspects') {
      return (
        <>
          <p className="bisect-result">The problem is not in the tested mods</p>
          <p className="muted">
            It was still there with every tested mod off, so it comes from a core mod, a mod you
            kept on, or the game itself.
          </p>
          <div className="bisect-actions">
            {undoButton}
            <button className="primary" disabled={locked} onClick={() => end(false)}>
              Switch everything back on
            </button>
          </div>
        </>
      )
    }

    const on = status.suspects.filter((id) => !status.off.includes(id))

    return (
      <>
        <p className="bisect-round">
          Round {status.round}
          <span className="muted">
            {' '}
            · at most {status.roundsLeft} {status.roundsLeft === 1 ? 'launch' : 'launches'} to go
          </span>
        </p>
        {!session.ready && (
          <div className="bisect-warning" role="alert">
            <span>
              The mods don&apos;t match this round yet. The last switch didn&apos;t finish.
            </span>
            <button
              className="small"
              disabled={locked}
              onClick={() => run('Switching mods...', () => window.api.applyBisect())}
            >
              Apply mod
            </button>
          </div>
        )}
        <p>
          {roundSummary(status)} Launch the game and try to recreate the problem, then close the
          game or let it crash and answer.
        </p>
        <div className="bisect-lists">
          <ModNames title="Switched off" names={namesOf(status.off, mods)} />
          {on.length > 0 && <ModNames title="Still suspected, on" names={namesOf(on, mods)} />}
        </div>
        <div className="bisect-actions">
          <div className="bisect-buttons">
            {undoButton}
            <button className="with-icon" disabled={locked} onClick={() => setConfirmingStop(true)}>
              <RotateCcw size={16} aria-hidden="true" />
              Stop and restore
            </button>
          </div>
          <div className="bisect-buttons">
            <button
              className="warning with-icon"
              disabled={!session.ready || locked}
              onClick={() => answer('broken')}
            >
              <CircleX size={16} aria-hidden="true" />
              Still broken
            </button>
            <button
              className="success with-icon"
              disabled={!session.ready || locked}
              onClick={() => answer('works')}
            >
              <CircleCheck size={16} aria-hidden="true" />
              Works now
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <section className="troubleshoot-panel" aria-labelledby="bisect-title">
      <header className="troubleshoot-panel-header">
        <div>
          <h3 id="bisect-title">Find a broken mod</h3>
          <p className="muted">
            Switches half of your mods off at a time. You launch the game and say whether the
            problem is still there. After a few rounds the app names the mod causing it. This
            assumes a single mod causes the problem.
          </p>
        </div>
        <span className="bisect-busy" aria-live="polite">
          {busy}
        </span>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {view === undefined && !error && <p className="muted">Loading...</p>}
      {view === null && renderSetup()}
      {view && renderSession(view)}
      {confirmingStop && (
        <ConfirmDialog
          title="Stop the bisect?"
          confirmLabel="Stop and restore"
          tone="primary"
          onConfirm={() => end(false)}
          onClose={() => setConfirmingStop(false)}
        >
          <p>Every tested mod is switched back on, and your answers so far are dropped.</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
