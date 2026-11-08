import { FRAMEWORKS, type Framework, type ModRecord } from '@shared/types'
import type { Dependency } from '@shared/requirements'
import { FRAMEWORK_LABELS } from '@renderer/modLabels'
import type { CoreUpdate } from '@renderer/updatesView'
import { UpdateButton } from './UpdateButton'
import './CoreModStatus.css'

interface CoreModStatusProps {
  installed: Dependency[]
  updates: Partial<Record<Framework, CoreUpdate>>
  onOpenFiles: (mod: ModRecord) => void
}

export function CoreModStatus({
  installed,
  updates,
  onOpenFiles
}: CoreModStatusProps): React.JSX.Element {
  return (
    <div className="core-status" aria-label="Core mods">
      {FRAMEWORKS.map((framework) => {
        const isInstalled = installed.includes(framework)
        const status = isInstalled
          ? 'Installed in the game folder'
          : 'Not installed in the game folder'
        const coreUpdate = updates[framework]

        return (
          <span key={framework} className="core-chip" title={status}>
            <span
              className={isInstalled ? 'dot dot-installed' : 'dot dot-missing'}
              aria-label={status}
            ></span>
            {FRAMEWORK_LABELS[framework]}
            {coreUpdate && (
              <UpdateButton
                update={coreUpdate.update}
                label="Update available"
                onClick={() => onOpenFiles(coreUpdate.mod)}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}
