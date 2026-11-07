import { useId, useState } from 'react'
import type { Result, Settings } from '@shared/types'
import './SettingToggle.css'

interface SettingToggleProps {
  label: string
  hint: string
  enabled: boolean
  save: (enabled: boolean) => Promise<Result<Settings>>
  onSettingsChange: (settings: Settings) => void
}

export function SettingToggle({
  label,
  hint,
  enabled,
  save,
  onSettingsChange
}: SettingToggleProps): React.JSX.Element {
  const hintId = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(next: boolean): Promise<void> {
    setSaving(true)
    setError(null)

    try {
      const result = await save(next)
      if (result.ok) {
        onSettingsChange(result.value)
      } else {
        setError(result.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="setting-toggle">
      <label className="setting-toggle-label">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          aria-describedby={hintId}
          onChange={(event) => toggle(event.target.checked)}
        />
        {label}
      </label>
      <p id={hintId} className="muted setting-toggle-hint">
        {hint}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  )
}
