import { useEffect, useState } from 'react'
import { Gamepad2, LoaderCircle } from 'lucide-react'
import type { MessageKey } from '@shared/i18n/en'
import { useT } from '@renderer/i18n/context'
import './LaunchButton.css'

const MESSAGE_MS = 6000
const STARTING_MS = 8000

type Stage = 'idle' | 'starting' | 'compiling'

const LABELS: Record<Stage, MessageKey> = {
  idle: 'launch.idle',
  starting: 'launch.starting',
  compiling: 'launch.compiling'
}

interface LaunchButtonProps {
  gamePath: string | null
}

export function LaunchButton({ gamePath }: LaunchButtonProps): React.JSX.Element {
  const [icon, setIcon] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    window.api.getGameIcon().then(setIcon)
  }, [gamePath])

  useEffect(() => window.api.onLaunchCompiling(() => setStage('compiling')), [])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [error])

  async function launch(): Promise<void> {
    setStage('starting')
    setError(null)

    const result = await window.api.launchGame()
    if (!result.ok) {
      setError(result.error)
      setStage('idle')
      return
    }
    setStage('starting')
    setTimeout(() => setStage('idle'), STARTING_MS)
  }

  const label = t(LABELS[stage])
  const busy = stage !== 'idle'

  return (
    <div className="launch">
      <button
        className="sidebar-button launch-button"
        onClick={launch}
        disabled={!gamePath || busy}
        title={label}
        aria-label={label}
      >
        {icon ? (
          <img src={icon} alt="" className="launch-icon" draggable={false} />
        ) : (
          <Gamepad2 size={22} aria-hidden="true" />
        )}
        {busy && <LoaderCircle size={16} className="launch-spinner spin" aria-hidden="true" />}
      </button>

      <div aria-live="polite">
        {stage === 'compiling' && (
          <p className="launch-bubble launch-status">{t('launch.compilingHint')}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="launch-bubble launch-error">
          {error}
        </p>
      )}
    </div>
  )
}
