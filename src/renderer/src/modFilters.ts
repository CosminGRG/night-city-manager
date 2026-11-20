import { isCoreMod } from '@shared/mods'
import type { DeployStatus, ModRecord, ModType } from '@shared/types'
import type { RequirementBadge } from './requirementsView'

export const MOD_VIEWS = ['all', 'active', 'inactive', 'attention', 'updates'] as const
export type ModView = (typeof MOD_VIEWS)[number]

export type TypeFilter = ModType | 'core'

export type SortColumn = 'status' | 'name' | 'type' | 'imported'

export interface Sort {
  column: SortColumn
  descending: boolean
}

export interface ListOptions {
  view: ModView
  types: TypeFilter[]
  sort: Sort | null
}

export const DEFAULT_LIST_OPTIONS: ListOptions = { view: 'all', types: [], sort: null }

export interface ModFacts {
  deployed: boolean
  attention: boolean
  update: boolean
}

export function isInterrupted(status: DeployStatus | undefined): boolean {
  return status === 'deploying' || status === 'undeploying'
}

export function modFacts(
  mod: ModRecord,
  status: DeployStatus | undefined,
  badges: RequirementBadge[],
  hasUpdate: boolean
): ModFacts {
  const unmet =
    status === 'deployed' && badges.some((badge) => !badge.optional && badge.state !== 'met')

  return {
    deployed: status === 'deployed',
    attention: isInterrupted(status) || mod.plan.warnings.length > 0 || unmet,
    update: hasUpdate
  }
}

export function inView(view: ModView, facts: ModFacts): boolean {
  switch (view) {
    case 'all':
      return true
    case 'active':
      return facts.deployed
    case 'inactive':
      return !facts.deployed
    case 'attention':
      return facts.attention
    case 'updates':
      return facts.update
  }
}

export function viewCounts(facts: ModFacts[]): Record<ModView, number> {
  const count = (view: ModView): number => facts.filter((item) => inView(view, item)).length

  return {
    all: count('all'),
    active: count('active'),
    inactive: count('inactive'),
    attention: count('attention'),
    updates: count('updates')
  }
}

export function matchesTypes(mod: ModRecord, types: readonly TypeFilter[]): boolean {
  if (types.length === 0) {
    return true
  }

  return types.some((type) => (type === 'core' ? isCoreMod(mod) : mod.plan.types.includes(type)))
}

export function nextSort(current: Sort | null, column: SortColumn): Sort | null {
  if (current?.column !== column) {
    return { column, descending: false }
  }

  return current.descending ? null : { column, descending: true }
}

export function statusRank(facts: ModFacts | undefined): number {
  if (facts?.attention) {
    return 0
  }

  return facts?.deployed ? 1 : 2
}
