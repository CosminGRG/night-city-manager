import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import type { Settings, ModsFolderInfo } from '@shared/types'
import { NexusLookupOption } from '@renderer/components/NexusLookupOption'
import { SettingToggle } from '@renderer/components/SettingToggle'
import { LanguagePicker } from '@renderer/components/LanguagePicker'
import { useT } from '@renderer/i18n/context'
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

  const t = useT()

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
      <h2>{t('nav.settings')}</h2>

      <div className="settings-group">
        {t('settings.gameFolder.title')}
        <div className="settings-row">
          <code className="settings-path">{settings.gamePath}</code>
          <button onClick={handleChangeGame}>{t('common.change')}</button>
        </div>
        <p className="muted settings-hint">{t('settings.gameFolder.hint')}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>

      <div className="settings-group">
        <h3>{t('settings.modsFolder.title')}</h3>
        <div className="settings-row">
          <code className="settings-path">{modsFolder?.path}</code>
          <button onClick={handleChangeMods} disabled={moving}>
            {moving ? t('settings.modsFolder.moving') : t('common.change')}
          </button>
        </div>
        {modsFolder?.sameDriveAsGame === true && (
          <p className="muted settings-hint">{t('settings.modsFolder.sameDrive')}</p>
        )}
        {modsFolder?.sameDriveAsGame === false && (
          <p className="warning settings-hint">{t('settings.modsFolder.otherDrive')}</p>
        )}
        <p className="muted settings-hint">{t('settings.modsFolder.hint')}</p>
        {modsError && (
          <p role="alert" className="error">
            {modsError}
          </p>
        )}
      </div>

      <div className="settings-group">
        <h3>{t('settings.modList.title')}</h3>
        <SettingToggle
          label={t('settings.modList.newestFirst')}
          hint={t('settings.modList.newestFirstHint')}
          enabled={settings.newestFirst}
          save={(next) => window.api.setNewestFirst(next)}
          onSettingsChange={onSettingsChange}
        />
        <SettingToggle
          label={t('settings.modList.confirmDependents')}
          hint={t('settings.modList.confirmDependentsHint')}
          enabled={settings.confirmDependents}
          save={(next) => window.api.setConfirmDependents(next)}
          onSettingsChange={onSettingsChange}
        />
      </div>

      <div className="settings-group">
        <h3>{t('settings.deploying.title')}</h3>
        <SettingToggle
          label={t('settings.deploying.autoRequirements')}
          hint={t('settings.deploying.autoRequirementsHint')}
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
        <h3>{t('settings.language.title')}</h3>
        <LanguagePicker current={settings.language} onSettingsChange={onSettingsChange} />
      </div>

      <div className="settings-group">
        <h3>{t('settings.about.title')}</h3>
        {info && (
          <p className="muted">
            {t('settings.about.version', {
              version: info.version,
              electron: info.electronVersion
            })}
            <br />
            {t('settings.about.dataFolder')} <code>{info.userDataPath}</code>
          </p>
        )}
        <p className="muted settings-hint">{t('settings.about.licenses')}</p>
      </div>
    </section>
  )
}
