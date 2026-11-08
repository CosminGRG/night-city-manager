import { useEffect, useState } from 'react'
import { Gamepad2, LoaderCircle } from 'lucide-react'
import './LaunchButton.css'

const MESSAGE_MS = 6000
const STARTING_MS = 8000

interface LaunchButtonProps {
  gamePath: string | null
}

export function LaunchButton({ gamePath }: LaunchButtonProps): React.JSX.Element {
  const [icon, setIcon] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.getGameIcon().then(setIcon)
  }, [gamePath])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [error])

  async function launch(): Promise<void> {
    setStarting(true)
    setError(null)

    const result = await window.api.launchGame()
    if (!result.ok) {
      setError(result.error)
      setStarting(false)
      return
    }
    setTimeout(() => setStarting(false), STARTING_MS)
  }

  const label = starting ? 'Starting Cyberpunk 2077...' : 'Launch Cyberpunk 2077'

  return (
    <div className="launch">
      <button
        className="sidebar-button launch-button"
        onClick={launch}
        disabled={!gamePath || starting}
        title={label}
        aria-label={label}
      >
        {icon ? (
          <img src={icon} alt="" className="launch-icon" draggable={false} />
        ) : (
          <Gamepad2 size={22} aria-hidden="true" />
        )}
        {starting && <LoaderCircle size={16} className="launch-spinner spin" aria-hidden="true" />}
      </button>
      {error && (
        <p role="alert" className="launch-error">
          {error}
        </p>
      )}
    </div>
  )
}
