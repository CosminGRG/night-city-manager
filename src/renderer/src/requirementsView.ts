import { FRAMEWORKS, type DeployStatus, type ModRecord, type NexusRequirement } from '@shared/types'
import {
  DEPENDENCIES,
  KNOWN_DEPENDENCIES,
  needs,
  provides,
  type Dependency
} from '@shared/requirements'

export type RequirementState = 'met' | 'not-deployed' | 'missing'

export interface RequirementBadge {
  key: string
  label: string
  state: RequirementState
  optional: boolean
  title: string
}

export interface RequirementContext {
  library: ModRecord[]
  installed: Dependency[]
  deployments: Record<string, DeployStatus>
  nexus: Record<number, NexusRequirement[]>
}

export interface MissingRequirements {
  mod: ModRecord
  missing: string[]
}

function isFramework(dependency: Dependency): boolean {
  return FRAMEWORKS.some((framework) => framework === dependency)
}

function rank(badge: RequirementBadge): number {
  if (badge.optional) return 3
  if (badge.state === 'missing') return 0
  return badge.state === 'not-deployed' ? 1 : 2
}

function withTitle(badge: Omit<RequirementBadge, 'title'>, title: string): RequirementBadge {
  return { ...badge, title: badge.optional ? `Optional: ${title}` : title }
}

function knownBadge(
  dependency: Dependency,
  optional: boolean,
  context: RequirementContext
): RequirementBadge | null {
  const { label, nexusId } = KNOWN_DEPENDENCIES[dependency]
  const provider = context.library.find((other) => provides(other.plan).includes(dependency))

  if (context.installed.includes(dependency)) {
    if (isFramework(dependency)) return null
    return withTitle({ key: dependency, label, state: 'met', optional }, `${label} is installed.`)
  }
  if (provider) {
    const title = `${label} is in your library (${provider.name}) but not deployed.`
    return withTitle({ key: dependency, label, state: 'not-deployed', optional }, title)
  }

  const where = nexusId === null ? 'It is free in your game store.' : 'Get it on Nexus Mods.'
  const title = `${label} is not installed. ${where}`
  return withTitle({ key: dependency, label, state: 'missing', optional }, title)
}

function nexusBadge(requirement: NexusRequirement, context: RequirementContext): RequirementBadge {
  const { nexusId, name: label, optional } = requirement
  const key = `nexus-${nexusId}`
  const provider = context.library.find((other) => other.nexusModId === nexusId)

  if (provider && context.deployments[provider.id] === 'deployed') {
    return withTitle({ key, label, state: 'met', optional }, `${label} is deployed.`)
  }
  if (provider) {
    const title = `${label} is in your library (${provider.name}) but not deployed.`
    return withTitle({ key, label, state: 'not-deployed', optional }, title)
  }

  const title = `${label} is not in your library. Get it on Nexus Mods.`
  return withTitle({ key, label, state: 'missing', optional }, title)
}

export function requirementBadges(mod: ModRecord, context: RequirementContext): RequirementBadge[] {
  const own = provides(mod.plan)
  const known = new Map<Dependency, boolean>(
    needs(mod.plan).map((dependency) => [dependency, false])
  )
  const unknown: NexusRequirement[] = []

  const fromNexus = mod.nexusModId === null ? [] : (context.nexus[mod.nexusModId] ?? [])
  for (const requirement of fromNexus) {
    if (requirement.nexusId === mod.nexusModId) continue

    const dependency = DEPENDENCIES.find(
      (candidate) => KNOWN_DEPENDENCIES[candidate].nexusId === requirement.nexusId
    )
    if (!dependency) {
      unknown.push(requirement)
    } else if (!own.includes(dependency)) {
      known.set(dependency, requirement.optional)
    }
  }

  const badges = [
    ...[...known].map(([dependency, optional]) => knownBadge(dependency, optional, context)),
    ...unknown.map((requirement) => nexusBadge(requirement, context))
  ].filter((badge) => badge !== null)

  return badges.sort((a, b) => rank(a) - rank(b))
}

function unmetRequired(mod: ModRecord, context: RequirementContext): RequirementBadge[] {
  return requirementBadges(mod, context).filter((badge) => !badge.optional && badge.state !== 'met')
}

export function missingForBulkDeploy(
  mods: ModRecord[],
  context: RequirementContext
): MissingRequirements[] {
  return mods
    .map((mod) => ({
      mod,
      missing: unmetRequired(mod, context)
        .filter((badge) => badge.state === 'missing')
        .map((badge) => badge.label)
    }))
    .filter((entry) => entry.missing.length > 0)
}

export function deployNotice(mod: ModRecord, context: RequirementContext): string | null {
  const unmet = unmetRequired(mod, context).map((badge) =>
    badge.state === 'not-deployed' ? `${badge.label} (in your library, not deployed)` : badge.label
  )

  if (unmet.length === 0) {
    return null
  }

  return `${mod.name} is deployed, but it still needs: ${unmet.join(', ')}.`
}
