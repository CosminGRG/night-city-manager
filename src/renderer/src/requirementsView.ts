import { FRAMEWORKS, type DeployStatus, type ModRecord, type NexusRequirement } from '@shared/types'
import {
  DEPENDENCIES,
  KNOWN_DEPENDENCIES,
  needs,
  provides,
  type Dependency
} from '@shared/requirements'
import type { Translate } from '@shared/i18n/translate'

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
  t: Translate
}

export interface MissingRequirements {
  mod: ModRecord
  missing: string[]
}

export interface DeployMessage {
  text: string
  tone: 'info' | 'warning'
}

function isFramework(dependency: Dependency): boolean {
  return FRAMEWORKS.some((framework) => framework === dependency)
}

function rank(badge: RequirementBadge): number {
  if (badge.optional) return 3
  if (badge.state === 'missing') return 0
  return badge.state === 'not-deployed' ? 1 : 2
}

function withTitle(
  badge: Omit<RequirementBadge, 'title'>,
  title: string,
  t: Translate
): RequirementBadge {
  return { ...badge, title: badge.optional ? t('requirements.optional', { title }) : title }
}

function knownBadge(
  dependency: Dependency,
  optional: boolean,
  context: RequirementContext
): RequirementBadge | null {
  const { t } = context
  const { label, nexusId } = KNOWN_DEPENDENCIES[dependency]
  const provider = context.library.find((other) => provides(other.plan).includes(dependency))

  if (context.installed.includes(dependency)) {
    if (isFramework(dependency)) return null
    const title = t('requirements.installed', { label })
    return withTitle({ key: dependency, label, state: 'met', optional }, title, t)
  }
  if (provider) {
    const title = t('requirements.inLibrary', { label, provider: provider.name })
    return withTitle({ key: dependency, label, state: 'not-deployed', optional }, title, t)
  }

  const title = t(nexusId === null ? 'requirements.missingStore' : 'requirements.missingNexus', {
    label
  })
  return withTitle({ key: dependency, label, state: 'missing', optional }, title, t)
}

function nexusBadge(requirement: NexusRequirement, context: RequirementContext): RequirementBadge {
  const { t } = context
  const { nexusId, name: label, optional } = requirement
  const key = `nexus-${nexusId}`
  const provider = context.library.find((other) => other.nexusModId === nexusId)

  if (provider && context.deployments[provider.id] === 'deployed') {
    const title = t('requirements.deployed', { label })
    return withTitle({ key, label, state: 'met', optional }, title, t)
  }
  if (provider) {
    const title = t('requirements.inLibrary', { label, provider: provider.name })
    return withTitle({ key, label, state: 'not-deployed', optional }, title, t)
  }

  const title = t('requirements.notInLibrary', { label })
  return withTitle({ key, label, state: 'missing', optional }, title, t)
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
  const { t } = context
  const unmet = unmetRequired(mod, context).map((badge) =>
    badge.state === 'not-deployed'
      ? t('requirements.notDeployedLabel', { label: badge.label })
      : badge.label
  )

  if (unmet.length === 0) {
    return null
  }

  return t('requirements.stillNeeds', { name: mod.name, labels: unmet.join(', ') })
}

export function deployMessage(
  mod: ModRecord,
  alsoDeployed: string[],
  context: RequirementContext
): DeployMessage | null {
  const also =
    alsoDeployed.length > 0
      ? context.t('requirements.alsoDeployed', { name: mod.name, names: alsoDeployed.join(', ') })
      : null

  const warning = deployNotice(mod, context)

  if (warning) {
    return { text: also ? `${also} ${warning}` : warning, tone: 'warning' }
  }

  return also ? { text: also, tone: 'info' } : null
}

function keysOf(mod: ModRecord): Set<string> {
  const keys = new Set<string>(provides(mod.plan))
  if (mod.nexusModId !== null) {
    keys.add(`nexus-${mod.nexusModId}`)
    const known = DEPENDENCIES.find(
      (dependency) => KNOWN_DEPENDENCIES[dependency].nexusId === mod.nexusModId
    )

    if (known) {
      keys.add(known)
    }
  }

  return keys
}

export function brokenBy(removed: ModRecord, context: RequirementContext): string[] {
  const keys = keysOf(removed)
  return context.library
    .filter((mod) => mod.id !== removed.id && context.deployments[mod.id] === 'deployed')
    .filter((mod) => unmetRequired(mod, context).some((badge) => keys.has(badge.key)))
    .map((mod) => mod.name)
}

export function undeployWarning(removed: ModRecord, context: RequirementContext): string | null {
  const names = brokenBy(removed, context)
  if (names.length === 0) {
    return null
  }

  return context.t('requirements.brokenBy', {
    count: names.length,
    names: names.join(', '),
    name: removed.name
  })
}
