import {
  DEPENDENCIES,
  KNOWN_DEPENDENCIES,
  needs,
  provides,
  type Dependency
} from '@shared/requirements'
import type { DeployStatus, ModRecord, NexusRequirement } from '@shared/types'

export interface RequirementSources {
  library: ModRecord[]
  installed: Dependency[]
  deployments: Record<string, DeployStatus>
  nexus: Record<number, NexusRequirement[]>
}

interface Required {
  known: Dependency[]
  nexusIds: number[]
}

function required(mod: ModRecord, nexus: Record<number, NexusRequirement[]>): Required {
  const own = provides(mod.plan)
  const known = new Set(needs(mod.plan))
  const nexusIds: number[] = []

  const listed = mod.nexusModId === null ? [] : (nexus[mod.nexusModId] ?? [])
  for (const requirement of listed) {
    if (requirement.nexusId === mod.nexusModId) continue

    const dependency = DEPENDENCIES.find(
      (candidate) => KNOWN_DEPENDENCIES[candidate].nexusId === requirement.nexusId
    )

    if (!dependency) {
      if (!requirement.optional) {
        nexusIds.push(requirement.nexusId)
      }
    } else if (requirement.optional) {
      known.delete(dependency)
    } else if (!own.includes(dependency)) {
      known.add(dependency)
    }
  }

  return { known: [...known], nexusIds }
}

function providersOf(mod: ModRecord, sources: RequirementSources): ModRecord[] {
  const { known, nexusIds } = required(mod, sources.nexus)
  const found: ModRecord[] = []

  for (const dependency of known) {
    if (sources.installed.includes(dependency)) {
      continue
    }

    const provider = sources.library.find((other) => provides(other.plan).includes(dependency))
    if (provider) {
      found.push(provider)
    }
  }

  for (const nexusId of nexusIds) {
    const provider = sources.library.find((other) => other.nexusModId === nexusId)
    if (provider) {
      found.push(provider)
    }
  }

  return found
}

export function requirementsToDeploy(mod: ModRecord, sources: RequirementSources): ModRecord[] {
  const order: ModRecord[] = []
  const seen = new Set<string>([mod.id])

  function visit(current: ModRecord): void {
    for (const provider of providersOf(current, sources)) {
      if (seen.has(provider.id)) {
        continue
      }
      seen.add(provider.id)

      const deployable =
        sources.deployments[provider.id] === undefined && provider.plan.files.length > 0
      if (!deployable) {
        continue
      }

      visit(provider)
      order.push(provider)
    }
  }

  visit(mod)
  return order
}
