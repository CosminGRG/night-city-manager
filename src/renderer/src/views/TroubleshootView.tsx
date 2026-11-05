import * as Tabs from '@radix-ui/react-tabs'
import { FlaskConical, FolderSearch, LifeBuoy, type LucideIcon } from 'lucide-react'
import { BisectPanel } from '@renderer/components/BisectPanel'
import { LeftoversPanel } from '@renderer/components/LeftoversPanel'
import { TroubleshootOverview } from '@renderer/components/TroubleshootOverview'
import './TroubleshootView.css'

export type TroubleshootTab = 'overview' | 'bisect' | 'leftovers'

const TABS: { tab: TroubleshootTab; label: string; Icon: LucideIcon }[] = [
  { tab: 'overview', label: 'Overview', Icon: LifeBuoy },
  { tab: 'bisect', label: 'Find a broken mod', Icon: FlaskConical },
  { tab: 'leftovers', label: 'Leftover files', Icon: FolderSearch }
]

interface TroubleshootViewProps {
  tab: TroubleshootTab
  onTabChange: (tab: TroubleshootTab) => void
}

export function TroubleshootView({ tab, onTabChange }: TroubleshootViewProps): React.JSX.Element {
  function change(value: string): void {
    const item = TABS.find((item) => item.tab === value)

    if (item) {
      onTabChange(item.tab)
    }
  }

  return (
    <section className="troubleshoot">
      <h2>Troubleshoot</h2>
      <Tabs.Root value={tab} onValueChange={change}>
        <Tabs.List className="troubleshoot-tabs" aria-label="Troubleshooting tools">
          {TABS.map(({ tab, label, Icon }) => (
            <Tabs.Trigger key={tab} value={tab} className="troubleshoot-tab">
              <Icon size={16} aria-hidden="true" />
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="overview" className="troubleshoot-content">
          <TroubleshootOverview onOpen={onTabChange} />
        </Tabs.Content>
        <Tabs.Content value="bisect" className="troubleshoot-content">
          <BisectPanel />
        </Tabs.Content>
        <Tabs.Content value="leftovers" className="troubleshoot-content">
          <LeftoversPanel />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  )
}
