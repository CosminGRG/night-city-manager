import type { BulkAction, DeployStatus, ModRecord } from '@shared/types'
import { bulkTargets } from './modListView'

export type CheckState = 'none' | 'some' | 'all'

export function checkState(selected: ReadonlySet<string>, ids: readonly string[]): CheckState {
  const count = ids.filter((id) => selected.has(id)).length
  if (count === 0) {
    return 'none'
  }
  return count === ids.length ? 'all' : 'some'
}

export function toggleAll(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  return checkState(selected, ids) === 'all' ? new Set() : new Set(ids)
}

export function selectedMods(mods: ModRecord[], selected: ReadonlySet<string>): ModRecord[] {
  return mods.filter((mod) => selected.has(mod.id))
}

export function selectionCounts(
  mods: ModRecord[],
  deployments: Record<string, DeployStatus>
): Record<BulkAction, number> {
  const count = (action: BulkAction): number => bulkTargets(mods, deployments, action, 'all').length

  return { deploy: count('deploy'), purge: count('purge'), remove: count('remove') }
}
