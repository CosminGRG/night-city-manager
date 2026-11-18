import { ExternalLink, FlaskConical, FolderSearch, ScrollText, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@shared/i18n/en'
import { useT } from '@renderer/i18n/context'
import type { TroubleshootTab } from '@renderer/views/TroubleshootView'
import './TroubleshootOverview.css'

const FIRST_STEPS: MessageKey[] = [
  'overview.step.update',
  'overview.step.requirements',
  'overview.step.purge',
  'overview.step.verify'
]

interface Tool {
  tab: TroubleshootTab
  title: MessageKey
  text: MessageKey
  action: MessageKey
  Icon: LucideIcon
}

interface TroubleshootOverviewProps {
  onOpen: (tab: TroubleshootTab) => void
}

const TOOLS: Tool[] = [
  {
    tab: 'bisect',
    title: 'troubleshoot.tab.bisect',
    text: 'overview.bisect.text',
    action: 'overview.bisect.action',
    Icon: FlaskConical
  },
  {
    tab: 'logs',
    title: 'troubleshoot.tab.logs',
    text: 'overview.logs.text',
    action: 'overview.logs.action',
    Icon: ScrollText
  },
  {
    tab: 'leftovers',
    title: 'troubleshoot.tab.leftovers',
    text: 'overview.leftovers.text',
    action: 'overview.leftovers.action',
    Icon: FolderSearch
  }
]

interface Resource {
  title: MessageKey
  source: string
  url: string
  text: MessageKey
}

const RESOURCES: Resource[] = [
  {
    title: 'overview.link.guide',
    source: 'REDmodding wiki',
    url: 'https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-users/user-guide-troubleshooting',
    text: 'overview.link.guideText'
  },
  {
    title: 'overview.link.bisect',
    source: 'REDmodding wiki',
    url: 'https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-users/user-guide-troubleshooting#bisecting',
    text: 'overview.link.bisectText'
  },
  {
    title: 'overview.link.cet',
    source: 'CET wiki',
    url: 'https://wiki.redmodding.org/cyber-engine-tweaks/getting-started/installing/troubleshooting',
    text: 'overview.link.cetText'
  },
  {
    title: 'overview.link.discord',
    source: 'Discord',
    url: 'https://discord.gg/redmodding',
    text: 'overview.link.discordText'
  }
]

export function TroubleshootOverview({ onOpen }: TroubleshootOverviewProps): React.JSX.Element {
  const t = useT()

  return (
    <div className="overview">
      <section className="troubleshoot-panel" aria-labelledby="first-steps-title">
        <h3 id="first-steps-title">{t('overview.firstSteps')}</h3>
        <ol className="overview-steps">
          {FIRST_STEPS.map((step) => (
            <li key={step}>{t(step)}</li>
          ))}
        </ol>
      </section>

      <div className="overview-tools">
        {TOOLS.map(({ tab, title, text, action, Icon }) => (
          <section key={tab} className="troubleshoot-panel overview-tool">
            <h3 className="with-icon">
              <Icon size={18} aria-hidden="true"></Icon>
              {t(title)}
            </h3>
            <p className="muted">{t(text)}</p>
            <button onClick={() => onOpen(tab)}>{t(action)}</button>
          </section>
        ))}
      </div>

      <section className="troubleshoot-panel" aria-labelledby="help-online-title">
        <h3 id="help-online-title">{t('overview.help')}</h3>
        <ul className="overview-links">
          {RESOURCES.map((resource) => (
            <li key={resource.url}>
              <a href={resource.url} target="_blank" rel="noreferrer">
                {t(resource.title)}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <span className="muted"> · {resource.source}</span>
              <p className="muted">{t(resource.text)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
