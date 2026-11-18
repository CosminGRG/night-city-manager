import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, CircleArrowUp } from 'lucide-react'
import type { ModRecord, ModUpdate } from '@shared/types'
import { updateTitle } from '@renderer/updatesView'
import { useI18n, useT } from '@renderer/i18n/context'
import './Menu.css'
import './VersionBadge.css'

interface VersionBadgeProps {
  mod: ModRecord
  versions: ModRecord[]
  update: ModUpdate | undefined
  deployed: boolean
  locked: boolean
  onPick: (version: ModRecord) => void
  onOpenFiles: () => void
}

function labelOf(mod: ModRecord): string {
  return mod.version ?? mod.name
}

interface VersionMenuProps {
  mod: ModRecord
  versions: ModRecord[]
  deployed: boolean
  locked: boolean
  onPick: (version: ModRecord) => void
}

function VersionMenu({
  mod,
  versions,
  deployed,
  locked,
  onPick
}: VersionMenuProps): React.JSX.Element {
  const t = useT()

  function pick(id: string): void {
    const version = versions.find((candidate) => candidate.id === id)
    if (version && version.id !== mod.id) onPick(version)
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="version-main"
          disabled={locked}
          title={labelOf(mod)}
          aria-label={t('mods.version.label', {
            version: labelOf(mod),
            name: mod.name,
            count: versions.length
          })}
        >
          <span className="version-text">{labelOf(mod)}</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align="start" sideOffset={4}>
          <DropdownMenu.Label className="menu-label">
            {deployed ? t('mods.version.switchTo') : t('mods.version.show')}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={mod.id} onValueChange={pick}>
            {versions.map((version, index) => (
              <DropdownMenu.RadioItem
                key={version.id}
                value={version.id}
                className="menu-item"
                title={version.name}
              >
                <span className="version-check">
                  <DropdownMenu.ItemIndicator>
                    <Check size={14} aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </span>
                {labelOf(version)}
                {index === 0 && <span className="version-tag">{t('mods.version.newest')}</span>}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function VersionBadge({
  mod,
  versions,
  update,
  deployed,
  locked,
  onPick,
  onOpenFiles
}: VersionBadgeProps): React.JSX.Element | null {
  const { t, language } = useI18n()

  if (versions.length < 2 && !mod.version && !update) {
    return null
  }

  return (
    <span className="version-badge">
      {versions.length > 1 ? (
        <VersionMenu
          mod={mod}
          versions={versions}
          deployed={deployed}
          locked={locked}
          onPick={onPick}
        />
      ) : (
        <span className="version-main" title={labelOf(mod)}>
          <span className="version-text">{mod.version ?? '?'}</span>
        </span>
      )}
      {update && (
        <button
          className="version-update"
          title={updateTitle(update, t, language)}
          aria-label={updateTitle(update, t, language)}
          onClick={onOpenFiles}
        >
          <CircleArrowUp size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
