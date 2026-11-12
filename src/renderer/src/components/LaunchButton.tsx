import { useEffect, useState } from 'react'
import { Gamepad2, LoaderCircle } from 'lucide-react'
import './LaunchButton.css'

const MESSAGE_MS = 6000
const STARTING_MS = 8000

type Stage = 'idle' | 'starting' | 'compiling'

const LABELS: Record<Stage, string> = {
  idle: 'Launch Cyberpunk 2077',
  starting: 'Starting Cyberpunk 2077...',
  compiling: 'Compiling REDmod mods...'
}

interface LaunchButtonProps {
  gamePath: string | null
}

export function LaunchButton({ gamePath }: LaunchButtonProps): React.JSX.Element {
  const [icon, setIcon] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)

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

  const label = LABELS[stage]
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
          <p className="launch-bubble launch-status">
            {label} This can take some time after you change them.
          </p>
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
