import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import type { Settings } from '@shared/types'
import './SettingsView.css'

interface SettingsViewProps {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
}

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.getAppInfo().then(setInfo)
  }, [])

  async function handleChangeGame(): Promise<void> {
    setError(null)
    const result = await window.api.browseGame()
    if (!result) return
    if (result.ok) {
      onSettingsChange(result.value)
    } else {
      setError(result.error)
    }
  }

  return (
    <section className="settings">
      <h2>Settings</h2>

      <div className="settings-group">
        <h3>Game folder</h3>
        <div className="settings-row">
          <code className="settings-path">{settings.gamePath}</code>
          <button onClick={handleChangeGame}>Change</button>
        </div>
        <p className="muted settings-hint">
          Each game folder keeps its own deployed mods. Switching back shows them again.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>

      <div className="settings-group">
        <h3>About</h3>
        {info && (
          <p className="muted">
            Night City Mod Manager {info.version} by Cosmin G. · Electron {info.electronVersion}
            <br />
            Data folder: <code>{info.userDataPath}</code>
          </p>
        )}
      </div>
    </section>
  )
}
