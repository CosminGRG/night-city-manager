import { FRAMEWORKS, type ModRecord } from '@shared/types'
import {
  KNOWN_DEPENDENCIES,
  needs,
  unmetRequirements,
  type Dependency,
  type UnmetRequirement
} from '@shared/requirements'

export type RequirementState = 'met' | 'not-deployed' | 'missing'

export interface RequirementBadge {
  key: string
  label: string
  state: RequirementState
  title: string
}

const ORDER: Record<RequirementState, number> = { missing: 0, 'not-deployed': 1, met: 2 }

function isFramework(dependency: Dependency): boolean {
  return FRAMEWORKS.some((framework) => framework === dependency)
}

function stateOf(problem: UnmetRequirement | undefined): RequirementState {
  if (!problem) return 'met'
  return problem.provider ? 'not-deployed' : 'missing'
}

function explain(dependency: Dependency, problem: UnmetRequirement | undefined): string {
  const { label, nexusId } = KNOWN_DEPENDENCIES[dependency]
  if (!problem) {
    return `${label} is installed.`
  }
  if (problem.provider) {
    return `${label} is in your library (${problem.provider.name}) but not deployed.`
  }
  if (nexusId === null) {
    return `${label} is not installed. It is free in your game store.`
  }

  return `${label} is not installed. Get it on Nexus Mods.`
}

export function requirementBadges(
  mod: ModRecord,
  library: ModRecord[],
  installed: Dependency[]
): RequirementBadge[] {
  const unmet = unmetRequirements(mod, library, installed)
  const badges: RequirementBadge[] = []

  for (const dependency of needs(mod.plan)) {
    const problem = unmet.find((item) => item.dependency === dependency)
    if (!problem && isFramework(dependency)) {
      continue
    }

    badges.push({
      key: dependency,
      label: KNOWN_DEPENDENCIES[dependency].label,
      state: stateOf(problem),
      title: explain(dependency, problem)
    })
  }

  return badges.sort((a, b) => ORDER[a.state] - ORDER[b.state])
}
