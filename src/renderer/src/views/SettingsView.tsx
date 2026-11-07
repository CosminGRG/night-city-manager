import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import type { Settings, ModsFolderInfo } from '@shared/types'
import { NexusLookupOption } from '@renderer/components/NexusLookupOption'
import { SettingToggle } from '@renderer/components/SettingToggle'
import './SettingsView.css'

interface SettingsViewProps {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
}

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modsFolder, setModsFolder] = useState<ModsFolderInfo | null>(null)
  const [moving, setMoving] = useState(false)
  const [modsError, setModsError] = useState<string | null>(null)

  useEffect(() => {
    window.api.getAppInfo().then(setInfo)
  }, [])

  useEffect(() => {
    window.api.getModsFolder().then(setModsFolder)
  }, [settings])

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

  async function handleChangeMods(): Promise<void> {
    setModsError(null)
    setMoving(true)

    try {
      const result = await window.api.changeModsFolder()
      if (!result) return
      if (result.ok) {
        onSettingsChange(result.value)
      } else {
        setModsError(result.error)
      }
    } finally {
      setMoving(false)
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
        <h3>Mods folder</h3>
        <div className="settings-row">
          <code className="settings-path">{modsFolder?.path}</code>
          <button onClick={handleChangeMods} disabled={moving}>
            {moving ? 'Moving mods...' : 'Change'}
          </button>
        </div>
        {modsFolder?.sameDriveAsGame === true && (
          <p className="muted settings-hint">
            Same drive as the game, deploys using hard links, which are instant and take no space.
          </p>
        )}
        {modsFolder?.sameDriveAsGame === false && (
          <p className="warning settings-hint">
            This folder is on a different drive than the game. The manager will work, but every
            deploy copies the files. Choose an empty folder on the game&apos;s drive for instant
            deploys.
          </p>
        )}
        <p className="muted settings-hint">
          Changing it moves all your mods there. Purge all mods first.
        </p>
        {modsError && (
          <p role="alert" className="error">
            {modsError}
          </p>
        )}
      </div>

      <div className="settings-group">
        <h3>Deploying</h3>
        <SettingToggle
          label="Deploy requirements automatically"
          hint="When you switch a mod on, the mods it needs that are in your library are deployed first. Optional requirements are left alone."
          enabled={settings.autoDeployRequirements}
          save={(next) => window.api.setAutoDeployRequirements(next)}
          onSettingsChange={onSettingsChange}
        />
      </div>

      <div className="settings-group">
        <h3>Nexus Mods</h3>
        <NexusLookupOption enabled={settings.nexusLookup} onSettingsChange={onSettingsChange} />
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
