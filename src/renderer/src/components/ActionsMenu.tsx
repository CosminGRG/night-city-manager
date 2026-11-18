import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ChevronDown,
  Power,
  PowerOff,
  ShieldCheck,
  Trash2,
  Layers,
  LoaderCircle
} from 'lucide-react'
import type { BulkRequest } from '@shared/types'
import type { BulkCounts } from '@renderer/modListView'
import { useT } from '@renderer/i18n/context'
import { MenuItem } from './MenuItem'
import './ActionsMenu.css'

interface ActionsMenuProps {
  counts: BulkCounts
  busyLabel: string | null
  locked: boolean
  onSelect: (request: BulkRequest) => void
}

export function ActionsMenu({
  counts,
  busyLabel,
  locked,
  onSelect
}: ActionsMenuProps): React.JSX.Element {
  const t = useT()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="actions-button" disabled={locked || counts.remove.all === 0}>
          {busyLabel ? (
            <LoaderCircle size={16} className="spin" aria-hidden="true" />
          ) : (
            <Layers size={16} aria-hidden="true" />
          )}
          {busyLabel ?? t('mods.actionsButton')}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align="start" sideOffset={4}>
          <MenuItem
            icon={Power}
            disabled={counts.deploy.all === 0}
            onSelect={() => onSelect({ action: 'deploy', scope: 'all' })}
          >
            {t('mods.actions.deployAll', { count: counts.deploy.all })}
          </MenuItem>
          <MenuItem
            icon={ShieldCheck}
            disabled={counts.deploy.core === 0}
            onSelect={() => onSelect({ action: 'deploy', scope: 'core' })}
          >
            {t('mods.actions.deployCore', { count: counts.deploy.core })}
          </MenuItem>

          <DropdownMenu.Separator className="menu-separator" />
          <MenuItem
            icon={PowerOff}
            disabled={counts.purge.all === 0}
            onSelect={() => onSelect({ action: 'purge', scope: 'all' })}
          >
            {t('mods.actions.purgeAll', { count: counts.purge.all })}
          </MenuItem>
          <MenuItem
            icon={ShieldCheck}
            disabled={counts.purge['non-core'] === 0}
            onSelect={() => onSelect({ action: 'purge', scope: 'non-core' })}
          >
            {t('mods.actions.purgeNonCore', { count: counts.purge['non-core'] })}
          </MenuItem>
          <DropdownMenu.Separator className="menu-separator" />
          <MenuItem
            icon={Trash2}
            danger
            disabled={counts.remove.all === 0}
            onSelect={() => onSelect({ action: 'remove', scope: 'all' })}
          >
            {t('mods.actions.removeAll', { count: counts.remove.all })}
          </MenuItem>
          <MenuItem
            icon={Trash2}
            danger
            disabled={counts.remove['non-core'] === 0}
            onSelect={() => onSelect({ action: 'remove', scope: 'non-core' })}
          >
            {t('mods.actions.removeNonCore', { count: counts.remove['non-core'] })}
          </MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
