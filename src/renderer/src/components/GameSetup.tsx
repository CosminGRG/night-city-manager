import { useEffect, useState } from 'react'
import { FolderSearch, Gamepad2, ArrowRight } from 'lucide-react'
import type { DetectedGame, GameStore, Result, Settings } from '@shared/types'
import { NexusLookupOption } from './NexusLookupOption'
import './GameSetup.css'

const STORE_LABELS: Record<GameStore, string> = {
  steam: 'Steam',
  gog: 'GOG',
  epic: 'Epic Games'
}

interface GameSetupProps {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
}

export function GameSetup({ settings, onSettingsChange }: GameSetupProps): React.JSX.Element {
  const [detected, setDetected] = useState<DetectedGame[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.detectGames().then(setDetected)
  }, [])

  function handleResult(result: Result<Settings> | null): void {
    if (!result) return
    if (result.ok) {
      onSettingsChange(result.value)
    } else {
      setError(result.error)
    }
  }

  const nothingFound = detected?.length === 0

  return (
    <section className="setup">
      <div className="setup-card">
        <Gamepad2 size={40} className="setup-icon" aria-hidden="true" />
        <h1>Welcome to Fixer</h1>
        <p className="muted">First, select where Cyberpunk 2077 is installed.</p>

        {detected === null && (
          <p className="muted" role="status">
            Looking for your game...
          </p>
        )}
        {nothingFound && <p className="muted">We couldn&apos;t find it automatically.</p>}
        {detected && detected.length > 0 && (
          <>
            <p>We found your game. Pick it to continue:</p>
            <ul className="setup-list">
              {detected.map((game) => (
                <li key={game.path}>
                  <button
                    className="setup-option"
                    onClick={() => window.api.selectGame(game.path).then(handleResult)}
                  >
                    <span className="setup-option-text">
                      <span className="setup-store">{STORE_LABELS[game.store]}</span>
                      <span className="setup-path">{game.path}</span>
                    </span>
                    <span className="setup-use">
                      Use this
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          className={nothingFound ? 'setup-browse primary' : 'setup-browse'}
          onClick={() => window.api.browseGame().then(handleResult)}
        >
          <FolderSearch size={16} aria-hidden="true" />
          {nothingFound ? 'Browse for the game folder' : 'Use a different folder'}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        <div className="setup-nexus">
          <NexusLookupOption enabled={settings.nexusLookup} onSettingsChange={onSettingsChange} />
        </div>
      </div>
    </section>
  )
}
