import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import type { ModRecord } from '@shared/types'
import './Menu.css'
import './VersionPicker.css'

interface VersionPickerProps {
  mod: ModRecord
  versions: ModRecord[]
  deployed: boolean
  locked: boolean
  onPick: (version: ModRecord) => void
}

function labelOf(mod: ModRecord): string {
  return mod.version ?? mod.name
}

export function VersionPicker({
  mod,
  versions,
  deployed,
  locked,
  onPick
}: VersionPickerProps): React.JSX.Element | null {
  if (versions.length < 2) {
    return mod.version ? <span className="mod-version">{mod.version}</span> : null
  }

  function pick(id: string): void {
    const version = versions.find((candidate) => candidate.id === id)
    if (version && version.id !== mod.id) {
      onPick(version)
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="version-trigger"
          disabled={locked}
          aria-label={`Version ${labelOf(mod)} of ${mod.name}, ${versions.length} versions`}
        >
          {labelOf(mod)}
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align="start" sideOffset={4}>
          <DropdownMenu.Label className="menu-label">
            {deployed ? 'Switch to version' : 'Show version'}
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
                {index === 0 && <span className="version-tag">newest</span>}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
