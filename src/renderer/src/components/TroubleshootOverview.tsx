import { ExternalLink, FlaskConical, FolderSearch, type LucideIcon } from 'lucide-react'
import type { TroubleshootTab } from '@renderer/views/TroubleshootView'
import './TroubleshootOverview.css'

const FIRST_STEPS = [
  'Update the game and your core mods. After a game patch, core mods often need a new version: check their Nexus pages.',
  'Check the requirements on the Nexus pages of mods you added recently.',
  "If the game doesn't start at all, purge all mods (Mod list → Actions → Purge all) and check that it starts without them.",
  'Still broken without mods? Verify the game files in Steam, GOG Galaxy or the Epic Games Launcher.'
]

interface Tool {
  tab: TroubleshootTab
  title: string
  text: string
  action: string
  Icon: LucideIcon
}

interface TroubleshootOverviewProps {
  onOpen: (tab: TroubleshootTab) => void
}

const TOOLS: Tool[] = [
  {
    tab: 'bisect',
    title: 'Find a broken mod',
    text: "The game crashes or something behaves oddly, you suspect a mod causes it but you don't know whihc. The app switches half of your mods off per round; you launch the game and say whether the problem is still there.",
    action: 'Find the mod',
    Icon: FlaskConical
  },
  {
    tab: 'leftovers',
    title: 'Leftover files',
    text: "Settings, logs and saved data that mods wrote into the game folder. Undeploying keeps them, review and delete what you don't need",
    action: 'Review leftovers',
    Icon: FolderSearch
  }
]

const RESOURCES = [
  {
    title: 'Troubleshooting guide',
    source: 'REDmodding wiki',
    url: 'https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-users/user-guide-troubleshooting',
    text: 'Step-by-step help for crashes, launch failures and script errors.'
  },
  {
    title: 'Bisecting by hand',
    source: 'REDmodding wiki',
    url: 'https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-users/user-guide-troubleshooting#bisecting',
    text: 'The method the Find a broken mod tab automates.'
  },
  {
    title: 'Cyber Engine Tweaks troubleshooting',
    source: 'CET wiki',
    url: 'https://wiki.redmodding.org/cyber-engine-tweaks/getting-started/installing/troubleshooting',
    text: "When the CET overlay doesn't open or CET mods don't load."
  },
  {
    title: 'Cyberpunk 2077 Modding Community',
    source: 'Discord',
    url: 'https://discord.gg/redmodding',
    text: 'Ask for help in the #mod-troubleshooting channel.'
  }
]

export function TroubleshootOverview({ onOpen }: TroubleshootOverviewProps): React.JSX.Element {
  return (
    <div className="overview">
      <section className="troubleshoot-panel" aria-labelledby="first-steps-title">
        <h3 id="first-steps-title">First steps</h3>
        <ol className="overview-steps">
          {FIRST_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <div className="overview-tools">
        {TOOLS.map(({ tab, title, text, action, Icon }) => (
          <section key={tab} className="troubleshoot-panel overview-tool">
            <h3 className="with-icon">
              <Icon size={18} aria-hidden="true"></Icon>
              {title}
            </h3>
            <p className="muted">{text}</p>
            <button onClick={() => onOpen(tab)}>{action}</button>
          </section>
        ))}
      </div>

      <section className="troubleshoot-panel" aria-labelledby="help-outline-title">
        <h3 id="help-online-title">Help online</h3>
        <ul className="overview-links">
          {RESOURCES.map((resouces) => (
            <li key={resouces.url}>
              <a href={resouces.url} target="_blank" rel="noreferrer">
                {resouces.title}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <span className="muted"> · {resouces.source}</span>
              <p className="muted">{resouces.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
