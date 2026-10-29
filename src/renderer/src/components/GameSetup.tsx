import { useEffect, useState } from 'react'
import type { DetectedGame, Result, Settings } from '@shared/types'

interface GameSetupProps {
  onSelected: (settings: Settings) => void
}

export function GameSetup({ onSelected }: GameSetupProps): React.JSX.Element {
  const [detected, setDetected] = useState<DetectedGame[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.detectGames().then(setDetected)
  }, [])

  function handleResult(result: Result<Settings> | null): void {
    if (!result) return
    if (result.ok) {
      onSelected(result.value)
    } else {
      setError(result.error)
    }
  }

  return (
    <section>
      <h2>Select your Cyberpunk 2077 installation folder</h2>
      {detected === null && <p>Searching...</p>}
      {detected?.length === 0 && <p>No installation found automatically.</p>}
      <ul>
        {detected?.map((game) => (
          <li key={game.path}>
            {game.store.toUpperCase()}: {game.path}{' '}
            <button onClick={() => window.api.selectGame(game.path).then(handleResult)}>
              Use this
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => window.api.browseGame().then(handleResult)}>Browse...</button>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
