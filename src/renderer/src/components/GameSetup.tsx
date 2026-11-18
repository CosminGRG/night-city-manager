import { useEffect, useState } from 'react'
import { FolderSearch, Gamepad2, ArrowRight } from 'lucide-react'
import type { DetectedGame, GameStore, Result, Settings } from '@shared/types'
import { NexusLookupOption } from './NexusLookupOption'
import { useT } from '@renderer/i18n/context'
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
  const t = useT()

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
        <h1>{t('setup.title')}</h1>
        <p className="muted"> {t('setup.intro')}</p>

        {detected === null && (
          <p className="muted" role="status">
            {t('setup.searching')}
          </p>
        )}
        {nothingFound && <p className="muted">{t('setup.notFound')}</p>}
        {detected && detected.length > 0 && (
          <>
            <p>{t('setup.found')}</p>
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
                      {t('setup.useThis')}
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
          {nothingFound ? t('setup.browse') : t('setup.browseOther')}
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
