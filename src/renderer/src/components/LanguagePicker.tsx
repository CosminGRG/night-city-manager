import { useEffect, useId, useState } from 'react'
import { FileDown, FolderOpen, Plus } from 'lucide-react'
import type { LanguageInfo, Settings } from '@shared/types'
import { useI18n } from '@renderer/i18n/context'
import { isListed, optionLabel } from '@renderer/languagesView'
import './LanguagePicker.css'

interface LanguagePickerProps {
  current: string | null
  onSettingsChange: (settings: Settings) => void
}

export function LanguagePicker({
  current,
  onSettingsChange
}: LanguagePickerProps): React.JSX.Element {
  const { t, reload } = useI18n()
  const hintId = useId()
  const [languages, setLanguages] = useState<LanguageInfo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.listLanguages().then(setLanguages)
  }, [])

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  async function choose(file: string | null): Promise<void> {
    const result = await window.api.setLanguage(file)
    if (!result.ok) {
      setError(result.error)
      return
    }

    onSettingsChange(result.value)
    await reload()
  }

  function handleAdd(): Promise<void> {
    return run(async () => {
      const result = await window.api.addLanguage()
      if (!result) {
        return
      }
      if (!result.ok) {
        setError(result.error)
        return
      }

      setLanguages(await window.api.listLanguages())
      const added = result.value
      if (added.length === 1) {
        await choose(added[0].file)
      } else {
        const names = added.map((info) => info.name).join(', ')
        setNotice(t('settings.language.added', { count: added.length, names }))
      }
    })
  }

  function handleOpenFolder(): Promise<void> {
    return run(async () => {
      const result = await window.api.openLanguagesFolder()
      if (!result.ok) {
        setError(result.error)
      }
    })
  }

  function handleSaveTemplate(): Promise<void> {
    return run(async () => {
      const result = await window.api.saveLanguageTemplate()
      if (!result) {
        return
      }
      if (result.ok) {
        setNotice(t('settings.language.templateSaved', { path: result.value }))
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="language-picker">
      {languages && (
        <select
          className="language-select"
          value={current ?? ''}
          disabled={busy}
          aria-label={t('settings.language.title')}
          aria-describedby={hintId}
          onChange={(event) => run(() => choose(event.target.value || null))}
        >
          <option value="">English</option>
          {current !== null && !isListed(current, languages) && (
            <option value={current} disabled>
              {t('settings.language.missing', { file: current })}
            </option>
          )}
          {languages.map((info) => (
            <option key={info.file} value={info.file}>
              {optionLabel(info, t)}
            </option>
          ))}
        </select>
      )}
      <p id={hintId} className="muted settings-hint">
        {t('settings.language.hint')}
      </p>
      <div className="language-actions">
        <button className="small with-icon" onClick={handleAdd} disabled={busy}>
          <Plus size={14} aria-hidden="true" />
          {t('settings.language.add')}
        </button>
        <button className="small with-icon" onClick={handleOpenFolder} disabled={busy}>
          <FolderOpen size={14} aria-hidden="true" />
          {t('settings.language.openFolder')}
        </button>
        <button className="small with-icon" onClick={handleSaveTemplate} disabled={busy}>
          <FileDown size={14} aria-hidden="true" />
          {t('settings.language.saveTemplate')}
        </button>
      </div>
      {notice && (
        <p role="status" className="muted settings-hint language-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  )
}
