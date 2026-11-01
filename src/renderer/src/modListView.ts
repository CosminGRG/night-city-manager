import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from './modLabels'
import { isCoreMod } from '@shared/mods'
import { BulkAction, BulkScope, DeployStatus, ModRecord } from '@shared/types'

export type BulkCounts = Record<BulkAction, Record<BulkScope, number>>

export const PAGE_SIZE = 15

export function sortMods(mods: ModRecord[]): ModRecord[] {
  return [...mods].sort((a, b) => Number(isCoreMod(b)) - Number(isCoreMod(a)))
}

function searchText(mod: ModRecord): string {
  return [
    mod.name,
    mod.version ?? '',
    ...mod.plan.types.map((type) => MOD_TYPE_LABELS[type]),
    ...mod.plan.providers.map((framework) => FRAMEWORK_LABELS[framework])
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

export function bulkCounts(
  mods: ModRecord[],
  deployments: Record<string, DeployStatus>
): BulkCounts {
  const count = (keep: (mod: ModRecord) => boolean): Record<BulkScope, number> => ({
    all: mods.filter(keep).length,
    core: mods.filter((mod) => keep(mod) && isCoreMod(mod)).length,
    'non-core': mods.filter((mod) => keep(mod) && !isCoreMod(mod)).length
  })

  return {
    deploy: count((mod) => deployments[mod.id] === undefined && mod.plan.files.length > 0),
    purge: count((mod) => deployments[mod.id] !== undefined),
    remove: count(() => true)
  }
}
