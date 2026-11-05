import type { BisectStatus, DeployStatus, ModRecord } from '@shared/types'
import { isCoreMod } from '@shared/mods'

const ALWAYS_KEEP = [/virtual\s*atelier/i]

export function bisectCandidates(
  mods: ModRecord[],
  deployments: Record<string, DeployStatus>
): ModRecord[] {
  return mods.filter((mod) => deployments[mod.id] === 'deployed' && !isCoreMod(mod))
}

export function defaultSuspects(candidates: ModRecord[]): Set<string> {
  const tested = candidates.filter((mod) => !ALWAYS_KEEP.some((name) => name.test(mod.name)))
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
