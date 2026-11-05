import React, { useState } from 'react'
import type { Settings } from '@shared/types'
import './NexusLookupOption.css'

interface NexusLookupOptionProps {
  enabled: boolean
  onSettingsChange: (settings: Settings) => void
}

export function NexusLookupOption({
  enabled,
  onSettingsChange
}: NexusLookupOptionProps): React.JSX.Element {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(next: boolean): Promise<void> {
    setSaving(true)
    setError(null)

    try {
      const result = await window.api.setNexusLookup(next)
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
    <div className="nexus-option">
      <label className="nexus-option-label">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          aria-describedby="nexus-option-hint"
          onChange={(event) => toggle(event.target.checked)}
        />
        Look up mod info on Nexus Mods
      </label>
      <p id="nexus-option-hint" className="muted nexus-option-hint">
        Finds out what your mods need from their Nexus pages.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  )
}
