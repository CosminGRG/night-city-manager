import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, PowerOff, ShieldCheck } from 'lucide-react'
import type { PurgeScope } from '@shared/types'
import { MenuItem } from './MenuItem'
import './PurgeMenu.css'

interface PurgeMenuProps {
  allCount: number
  nonCoreCount: number
  purging: boolean
  locked: boolean
  onPurge: (scope: PurgeScope) => void
}

export function PurgeMenu({
  allCount,
  nonCoreCount,
  purging,
  locked,
  onPurge
}: PurgeMenuProps): React.JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="purge-button" disabled={locked || allCount === 0}>
          {purging ? 'Purging...' : 'Purge'}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align="start" sideOffset={4}>
          <MenuItem icon={PowerOff} disabled={allCount === 0} onSelect={() => onPurge('all')}>
            Purge all ({allCount})
          </MenuItem>
          <MenuItem
            icon={ShieldCheck}
            disabled={nonCoreCount === 0}
            onSelect={() => onPurge('non-core')}
          >
            Purge all but core mods ({nonCoreCount})
          </MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
