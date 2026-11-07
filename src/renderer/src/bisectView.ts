import type { BisectStatus, DeployStatus, ModRecord, NexusRequirement } from '@shared/types'
import { isCoreMod } from '@shared/mods'
import { needs, provides } from '@shared/requirements'

export function bisectCandidates(
  mods: ModRecord[],
  deployments: Record<string, DeployStatus>
): ModRecord[] {
  return mods.filter((mod) => deployments[mod.id] === 'deployed' && !isCoreMod(mod))
}

function requiresOnNexus(
  other: ModRecord,
  mod: ModRecord,
  nexus: Record<number, NexusRequirement[]>
): boolean {
  if (other.nexusModId === null || mod.nexusModId === null) {
    return false
  }

  const requirements = nexus[other.nexusModId] ?? []
  return requirements.some((item) => !item.optional && item.nexusId === mod.nexusModId)
}

export function neededBy(
  mod: ModRecord,
  candidates: ModRecord[],
  nexus: Record<number, NexusRequirement[]>
): string[] {
  const provided = provides(mod.plan)

  return candidates
    .filter((other) => other.id !== mod.id)
    .filter(
      (other) =>
        needs(other.plan).some((dependency) => provided.includes(dependency)) ||
        requiresOnNexus(other, mod, nexus)
    )
    .map((other) => other.name)
}

export function isLibrary(
  mod: ModRecord,
  candidates: ModRecord[],
  nexus: Record<number, NexusRequirement[]>
): boolean {
  return provides(mod.plan).length > 0 || neededBy(mod, candidates, nexus).length > 0
}

export function defaultSuspects(
  candidates: ModRecord[],
  nexus: Record<number, NexusRequirement[]>
): Set<string> {
  const tested = candidates.filter((mod) => !isLibrary(mod, candidates, nexus))
  return new Set(tested.map((mod) => mod.id))
}

export function roundCount(suspects: number, checkFirst: boolean): number {
  if (suspects < 2) return 0
  return Math.ceil(Math.log2(suspects)) + (checkFirst ? 1 : 0)
}

export function namesOf(ids: string[], mods: ModRecord[]): string[] {
  const names = new Map(mods.map((mod) => [mod.id, mod.name]))
  return ids.map((id) => names.get(id) ?? 'A removed mod')
}

export function roundSummary(status: Extract<BisectStatus, { kind: 'testing' }>): string {
  const { off, suspects, checking } = status
  if (checking) {
    return `All ${suspects.length} tested mods are switched off.`
  }

  return `${off.length} of the ${suspects.length} remaining suspects are switched off.`
}
