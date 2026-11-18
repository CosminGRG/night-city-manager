import { useEffect, useState } from 'react'
import { CircleCheck, CircleX, Play, RotateCcw, Undo2 } from 'lucide-react'
import type {
  BisectAnswer,
  BisectView,
  DeployStatus,
  ModRecord,
  Result,
  NexusRequirement
} from '@shared/types'
import {
  bisectCandidates,
  defaultSuspects,
  namesOf,
  roundCount,
  roundSummary,
  neededBy
} from '@renderer/bisectView'
import { toggleItems } from '@renderer/leftoversView'
import { useT } from '@renderer/i18n/context'
import { insert } from '@renderer/i18n/insert'
import { ConfirmDialog } from './ConfirmDialog'
import './BisectPanel.css'

interface BisectState {
  view: Result<BisectView | null>
  mods: ModRecord[]
  deployments: Record<string, DeployStatus>
  nexus: Record<number, NexusRequirement[]>
}

async function loadBisectState(): Promise<BisectState> {
  const [view, mods, deployments, nexus] = await Promise.all([
    window.api.getBisect(),
    window.api.listMods(),
    window.api.listDeployments(),
    window.api.getNexusRequirements()
  ])
  return { view, mods, deployments, nexus }
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
  const [nexus, SetNexus] = useState<Record<number, NexusRequirement[]>>({})
  const [candidates, setCandidates] = useState<ModRecord[]>([])
  const [suspects, setSuspects] = useState<Set<string>>(new Set())
  const [checkFirst, setCheckFirst] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingStop, setConfirmingStop] = useState(false)
  const t = useT()

  function apply(state: BisectState): void {
    const offered = bisectCandidates(state.mods, state.deployments)
    setMods(state.mods)
    setCandidates(offered)
    SetNexus(state.nexus)
    setSuspects(defaultSuspects(offered, state.nexus))

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
    run(t('bisect.busy.switching'), () => window.api.startBisect(ordered, checkFirst))
  }

  function answer(value: BisectAnswer): void {
    run(t('bisect.busy.switching'), () => window.api.answerBisect(value))
  }

  function undo(): void {
    run(t('bisect.busy.switching'), () => window.api.undoBisect())
  }

  function end(keepCulpritOff: boolean): void {
    run(t('bisect.busy.restoring'), () => window.api.endBisect(keepCulpritOff))
  }

  const locked = busy !== null

  function keptTitle(mod: ModRecord): string | undefined {
    const users = neededBy(mod, candidates, nexus)
    return users.length > 0 ? t('bisect.neededBy', { names: users.join(', ') }) : undefined
  }

  function renderSetup(): React.ReactNode {
    if (candidates.length < 2) {
      return <p className="muted">{t('bisect.needTwo')}</p>
    }

    const rounds = roundCount(suspects.size, checkFirst)
    const tested = { tested: suspects.size, total: candidates.length }

    return (
      <>
        <p className="">{t('bisect.setupHint')}</p>

        <ul className="bisect-candidates">
          {candidates.map((mod) => (
            <li key={mod.id}>
              <label>
                <input
                  type="checkbox"
                  checked={suspects.has(mod.id)}
                  onChange={(event) =>
                    setSuspects((current) => toggleItems(current, [mod.id], event.target.checked))
                  }
                />
                <span className="bisect-mod-name">{mod.name}</span>
                {!suspects.has(mod.id) && (
                  <span className="muted bisect-kept" title={keptTitle(mod)}>
                    {t('bisect.alwaysOn')}
                  </span>
                )}
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
            {t('bisect.checkFirst')}
            <span className="muted"> {t('bisect.checkFirstHint')}</span>
          </span>
        </label>
        <div className="bisect-actions">
          <span className="muted">
            {rounds > 0
              ? t('bisect.testedRounds', { ...tested, count: rounds })
              : t('bisect.tested', tested)}
          </span>
          <button
            className="primary with-icon"
            disabled={suspects.size < 2 || locked}
            onClick={start}
          >
            <Play size={16} aria-hidden="true" />
            {t('bisect.start')}
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
        {t('bisect.undo')}
      </button>
    )

    if (status.kind === 'found') {
      const culprit = namesOf([status.culprit], mods, t)[0]

      return (
        <>
          <p className="bisect-result">
            {insert(t('bisect.found'), { name: <strong>{culprit}</strong> })}
          </p>
          <p className="muted">{t('bisect.foundHint')}</p>
          <div className="bisect-actions">
            {undoButton}
            <div className="bisect-buttons">
              <button disabled={locked} onClick={() => end(false)}>
                {t('bisect.allOn')}
              </button>
              <button className="primary" disabled={locked} onClick={() => end(true)}>
                {t('bisect.keepOff')}
              </button>
            </div>
          </div>
        </>
      )
    }

    if (status.kind === 'not-in-suspects') {
      return (
        <>
          <p className="bisect-result">{t('bisect.notFound')}</p>
          <p className="muted">{t('bisect.notFoundHint')}</p>
          <div className="bisect-actions">
            {undoButton}
            <button className="primary" disabled={locked} onClick={() => end(false)}>
              {t('bisect.allOn')}
            </button>
          </div>
        </>
      )
    }

    const on = status.suspects.filter((id) => !status.off.includes(id))

    return (
      <>
        <p className="bisect-round">
          {t('bisect.round', { round: status.round })}
          <span className="muted"> · {t('bisect.roundsLeft', { count: status.roundsLeft })}</span>
        </p>
        {!session.ready && (
          <div className="bisect-warning" role="alert">
            <span>{t('bisect.notReady')}</span>
            <button
              className="small"
              disabled={locked}
              onClick={() => run(t('bisect.busy.switching'), () => window.api.applyBisect())}
            >
              {t('bisect.apply')}
            </button>
          </div>
        )}
        <p>
          {roundSummary(status, t)} {t('bisect.instructions')}
        </p>
        <div className="bisect-lists">
          <ModNames title={t('bisect.switchedOff')} names={namesOf(status.off, mods, t)} />
          {on.length > 0 && <ModNames title={t('bisect.stillOn')} names={namesOf(on, mods, t)} />}
        </div>
        <div className="bisect-actions">
          <div className="bisect-buttons">
            {undoButton}
            <button className="with-icon" disabled={locked} onClick={() => setConfirmingStop(true)}>
              <RotateCcw size={16} aria-hidden="true" />
              {t('bisect.stop')}
            </button>
          </div>
          <div className="bisect-buttons">
            <button
              className="warning with-icon"
              disabled={!session.ready || locked}
              onClick={() => answer('broken')}
            >
              <CircleX size={16} aria-hidden="true" />
              {t('bisect.broken')}
            </button>
            <button
              className="success with-icon"
              disabled={!session.ready || locked}
              onClick={() => answer('works')}
            >
              <CircleCheck size={16} aria-hidden="true" />
              {t('bisect.works')}
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
          <h3 id="bisect-title">{t('troubleshoot.tab.bisect')}</h3>
          <p className="muted">{t('bisect.intro')}</p>
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
      {view === undefined && !error && <p className="muted">{t('app.loading')}</p>}
      {view === null && renderSetup()}
      {view && renderSession(view)}
      {confirmingStop && (
        <ConfirmDialog
          title={t('bisect.stopTitle')}
          confirmLabel={t('bisect.stop')}
          tone="primary"
          onConfirm={() => end(false)}
          onClose={() => setConfirmingStop(false)}
        >
          <p>{t('bisect.stopBody')}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
