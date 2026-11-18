import * as Tabs from '@radix-ui/react-tabs'
import { FlaskConical, FolderSearch, LifeBuoy, ScrollText, type LucideIcon } from 'lucide-react'
import { BisectPanel } from '@renderer/components/BisectPanel'
import { LeftoversPanel } from '@renderer/components/LeftoversPanel'
import { LogsPanel } from '@renderer/components/LogsPanel'
import { TroubleshootOverview } from '@renderer/components/TroubleshootOverview'
import type { MessageKey } from '@shared/i18n/en'
import { useT } from '@renderer/i18n/context'
import './TroubleshootView.css'

export type TroubleshootTab = 'overview' | 'bisect' | 'logs' | 'leftovers'

const TABS: { tab: TroubleshootTab; label: MessageKey; Icon: LucideIcon }[] = [
  { tab: 'overview', label: 'troubleshoot.tab.overview', Icon: LifeBuoy },
  { tab: 'bisect', label: 'troubleshoot.tab.bisect', Icon: FlaskConical },
  { tab: 'logs', label: 'troubleshoot.tab.logs', Icon: ScrollText },
  { tab: 'leftovers', label: 'troubleshoot.tab.leftovers', Icon: FolderSearch }
]

interface TroubleshootViewProps {
  tab: TroubleshootTab
  onTabChange: (tab: TroubleshootTab) => void
}

export function TroubleshootView({ tab, onTabChange }: TroubleshootViewProps): React.JSX.Element {
  const t = useT()

  function change(value: string): void {
    const item = TABS.find((item) => item.tab === value)

    if (item) {
      onTabChange(item.tab)
    }
  }

  return (
    <section className="troubleshoot">
      <h2>{t('nav.troubleshoot')}</h2>
      <Tabs.Root value={tab} onValueChange={change}>
        <Tabs.List className="troubleshoot-tabs" aria-label={t('troubleshoot.tabs')}>
          {TABS.map(({ tab, label, Icon }) => (
            <Tabs.Trigger key={tab} value={tab} className="troubleshoot-tab">
              <Icon size={16} aria-hidden="true" />
              {t(label)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="overview" className="troubleshoot-content">
          <TroubleshootOverview onOpen={onTabChange} />
        </Tabs.Content>
        <Tabs.Content value="bisect" className="troubleshoot-content">
          <BisectPanel />
        </Tabs.Content>
        <Tabs.Content value="logs" className="troubleshoot-content">
          <LogsPanel />
        </Tabs.Content>
        <Tabs.Content value="leftovers" className="troubleshoot-content">
          <LeftoversPanel />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  )
}
