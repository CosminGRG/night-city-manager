import { isCoreMod } from '@shared/mods'
import { BulkAction, BulkScope, DeployStatus, ModRecord } from '@shared/types'
import { KNOWN_DEPENDENCIES, needs } from '@shared/requirements'
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from './modLabels'

export type BulkCounts = Record<BulkAction, Record<BulkScope, number>>

export const PAGE_SIZE = 13

export function sortMods(mods: ModRecord[]): ModRecord[] {
  return [...mods].sort((a, b) => Number(isCoreMod(b)) - Number(isCoreMod(a)))
}

function searchText(mod: ModRecord): string {
  return [
    mod.name,
    mod.version ?? '',
    isCoreMod(mod) ? 'core' : '',
    ...mod.plan.types.map((type) => MOD_TYPE_LABELS[type]),
    ...mod.plan.providers.map((framework) => FRAMEWORK_LABELS[framework]),
    ...needs(mod.plan).map((dependency) => KNOWN_DEPENDENCIES[dependency].label)
  ]
    .join(' ')
    .toLowerCase()
}

export function filterMods(mods: ModRecord[], query: string): ModRecord[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return mods
  return mods.filter((mod) => {
    const text = searchText(mod)
    return words.every((word) => text.includes(word))
  })
}

export interface Page<T> {
  items: T[]
  page: number
  pageCount: number
  total: number
  first: number
  last: number
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)

  return {
    items: pageItems,
    page: current,
    pageCount,
    total: items.length,
    first: items.length === 0 ? 0 : start + 1,
    last: start + pageItems.length
  }
}

export type PageLink = number | 'gap'

export function pageNumbers(page: number, pageCount: number): PageLink[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const wanted = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b)

  const links: PageLink[] = []
  for (const n of wanted) {
    const previous = links[links.length - 1]
    if (typeof previous === 'number' && n - previous === 2) {
      links.push(previous + 1)
    } else if (typeof previous === 'number' && n - previous > 2) {
      links.push('gap')
    }
    links.push(n)
  }

  return links
}

function isTarget(
  mod: ModRecord,
  action: BulkAction,
  deployments: Record<string, DeployStatus>,
  skip: ReadonlySet<string>
): boolean {
  if (action === 'deploy') {
    return deployments[mod.id] === undefined && mod.plan.files.length > 0 && !skip.has(mod.id)
  }
  if (action === 'purge') {
    return deployments[mod.id] !== undefined
  }

  return true
}

function inScope(mod: ModRecord, scope: BulkScope): boolean {
  if (scope === 'core') {
    return isCoreMod(mod)
  }
  if (scope === 'non-core') {
    return !isCoreMod(mod)
  }

  return true
}

export function bulkTargets(
  mods: ModRecord[],
  deployments: Record<string, DeployStatus>,
  action: BulkAction,
  scope: BulkScope,
  skip: ReadonlySet<string> = new Set()
): ModRecord[] {
  return mods.filter((mod) => isTarget(mod, action, deployments, skip) && inScope(mod, scope))
}

export function bulkCounts(
  mods: ModRecord[],
  deployments: Record<string, DeployStatus>,
  skip: ReadonlySet<string> = new Set()
): BulkCounts {
  const count = (action: BulkAction): Record<BulkScope, number> => ({
    all: bulkTargets(mods, deployments, action, 'all', skip).length,
    core: bulkTargets(mods, deployments, action, 'core', skip).length,
    'non-core': bulkTargets(mods, deployments, action, 'non-core', skip).length
  })

  return { deploy: count('deploy'), purge: count('purge'), remove: count('remove') }
}
