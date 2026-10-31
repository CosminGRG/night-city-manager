import type { Framework } from '@shared/types'
import { FRAMEWORK_LABELS, FRAMEWORKS } from '@renderer/modLabels'
import './CoreModStatus.css'

export function CoreModStatus({ installed }: { installed: Framework[] }): React.JSX.Element {
  return (
    <div className="core-status" aria-label="Core mods">
      {FRAMEWORKS.map((framework) => {
        const isInstalled = installed.includes(framework)
        const status = isInstalled
          ? 'Installed in the game folder'
          : 'Not installed in the game folder'
        return (
          <span key={framework} className="core-chip" title="status">
            <span
              className={isInstalled ? 'dot dot-installed' : 'dot dot-missing'}
              aria-label={status}
            ></span>
            {FRAMEWORK_LABELS[framework]}
          </span>
        )
      })}
    </div>
  )
}
