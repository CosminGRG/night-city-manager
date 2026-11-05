import { FRAMEWORKS } from '@shared/types'
import type { Dependency } from '@shared/requirements'
import { FRAMEWORK_LABELS } from '@renderer/modLabels'
import './CoreModStatus.css'

export function CoreModStatus({ installed }: { installed: Dependency[] }): React.JSX.Element {
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
