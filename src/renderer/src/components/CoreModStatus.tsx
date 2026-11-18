import { FRAMEWORKS, type Framework, type ModRecord } from '@shared/types'
import type { Dependency } from '@shared/requirements'
import { FRAMEWORK_LABELS } from '@renderer/modLabels'
import type { CoreUpdate } from '@renderer/updatesView'
import { useT } from '@renderer/i18n/context'
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
  const t = useT()

  return (
    <div className="core-status" aria-label={t('mods.coreStrip')}>
      {FRAMEWORKS.map((framework) => {
        const isInstalled = installed.includes(framework)
        const status = isInstalled ? t('mods.coreInstalled') : t('mods.coreMissing')
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
                label={t('updates.available')}
                onClick={() => onOpenFiles(coreUpdate.mod)}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}
