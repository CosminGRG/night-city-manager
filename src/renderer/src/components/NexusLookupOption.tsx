import type { Settings } from '@shared/types'
import { SettingToggle } from './SettingToggle'

interface NexusLookupOptionProps {
  enabled: boolean
  onSettingsChange: (settings: Settings) => void
}

export function NexusLookupOption({
  enabled,
  onSettingsChange
}: NexusLookupOptionProps): React.JSX.Element {
  return (
    <SettingToggle
      label="Look up mod info on Nexus Mods"
      hint="Finds out what your mods need from their Nexus pages."
      enabled={enabled}
      save={(next) => window.api.setNexusLookup(next)}
      onSettingsChange={onSettingsChange}
    />
  )
}
