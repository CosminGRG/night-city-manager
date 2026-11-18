import type { Settings } from '@shared/types'
import { useT } from '@renderer/i18n/context'
import { SettingToggle } from './SettingToggle'

interface NexusLookupOptionProps {
  enabled: boolean
  onSettingsChange: (settings: Settings) => void
}

export function NexusLookupOption({
  enabled,
  onSettingsChange
}: NexusLookupOptionProps): React.JSX.Element {
  const t = useT()

  return (
    <SettingToggle
      label={t('settings.nexus.lookup')}
      hint={t('settings.nexus.lookupHint')}
      enabled={enabled}
      save={(next) => window.api.setNexusLookup(next)}
      onSettingsChange={onSettingsChange}
    />
  )
}
