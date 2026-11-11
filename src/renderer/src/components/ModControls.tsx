import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ExternalLink, FolderOpen, Files, Trash2, Link2 } from 'lucide-react'
import type { DeployStatus, ModRecord } from '@shared/types'
import { MenuItem } from './MenuItem'
import './ModControls.css'

export interface ModActions {
  deploy: (mod: ModRecord) => void
  undeploy: (mod: ModRecord) => void
  remove: (mod: ModRecord) => void
  reveal: (mod: ModRecord) => void
  openNexus: (mod: ModRecord) => void
  openNexusFiles: (mod: ModRecord) => void
  linkVersion: (mod: ModRecord) => void
}

interface ModControlsProps {
  mod: ModRecord
  status: DeployStatus | undefined
  busyLabel: string | null
  locked: boolean
  actions: ModActions
}

function switchTitle(status: DeployStatus | undefined, nothingToDeploy: boolean): string {
  if (status === 'deployed') return 'Deployed. Click to undeploy.'
  if (status) return 'Interrupted. Click to clean up.'
  if (nothingToDeploy) return 'This mod has no files that can be placed automatically'
  return 'Not deployed. Click to deploy.'
}

export function ModControls({
  mod,
  status,
  busyLabel,
  locked,
  actions
}: ModControlsProps): React.JSX.Element {
  const nothingToDeploy = mod.plan.files.length === 0
  const interrupted = status !== undefined && status !== 'deployed'

  return (
    <div className="mod-controls">
      <span className="busy-label" aria-live="polite">
        {busyLabel && <span key={busyLabel}>{busyLabel}</span>}
      </span>

      <div className={interrupted ? 'pill interrupted' : 'pill'}>
        <button
          type="button"
          role="switch"
          aria-checked={status === 'deployed'}
          aria-label={`Deploy ${mod.name}`}
          title={switchTitle(status, nothingToDeploy)}
          className="pill-switch"
          disabled={locked || (!status && nothingToDeploy)}
          onClick={() => (status ? actions.undeploy(mod) : actions.deploy(mod))}
        >
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="pill-menu" aria-label={`More actions for ${mod.name}`}>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="menu" align="end" sideOffset={4}>
              <MenuItem icon={FolderOpen} onSelect={() => actions.reveal(mod)}>
                Reveal in Explorer
              </MenuItem>
              <MenuItem
                icon={ExternalLink}
                disabled={mod.nexusModId === null}
                onSelect={() => actions.openNexus(mod)}
              >
                Open Nexus page
              </MenuItem>
              <MenuItem
                icon={Files}
                disabled={mod.nexusModId === null}
                onSelect={() => actions.openNexusFiles(mod)}
              >
                View files on Nexus
              </MenuItem>
              {mod.nexusModId === null && (
                <MenuItem icon={Link2} disabled={locked} onSelect={() => actions.linkVersion(mod)}>
                  Set as version of...
                </MenuItem>
              )}

              <DropdownMenu.Separator className="menu-separator" />
              <MenuItem icon={Trash2} danger disabled={locked} onSelect={() => actions.remove(mod)}>
                Remove
              </MenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  )
}
