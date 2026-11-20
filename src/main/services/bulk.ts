import type { BulkResult, BulkScope, DeployStatus, ModRecord, VersionGroup } from '@shared/types'
import { isCoreMod } from '@shared/mods'
import { deployMod, undeployMod, type DeployContext } from './deployer'
import { undeployAndRemove, type RemoveContext } from './removal'
import { versionsToSkip, deployedSiblings } from './versions'

export type BulkTargets = BulkScope | readonly string[]

type Task = (mod: ModRecord) => Promise<string[]>

async function runEach(mods: ModRecord[], skipped: number, task: Task): Promise<BulkResult> {
  const result: BulkResult = { done: 0, skipped, kept: [], failed: [] }
  for (const mod of mods) {
    try {
      const kept = await task(mod)
      result.done++
      if (kept.length > 0) {
        result.kept.push({ name: mod.name, files: kept })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.failed.push({ name: mod.name, error: message })
    }
  }
  return result
}

function inTargets(mod: ModRecord, targets: BulkTargets): boolean {
  if (typeof targets !== 'string') {
    return targets.includes(mod.id)
  }
  if (targets === 'all') {
    return true
  }

  return isCoreMod(mod) === (targets === 'core')
}

// The user picked these exact versions, so the "newest version" rule doesn't apply.
// Still one version per mod in the game: skip a pick whose other version is deployed,
// and a second pick from the same mod.
function pickedTwice(
  ids: readonly string[],
  groups: VersionGroup[],
  statuses: Map<string, DeployStatus>
): Set<string> {
  const skip = new Set<string>()
  const seen = new Set<string>()

  for (const id of ids) {
    const group = groups.find(({ modIds }) => modIds.includes(id))
    if (!group) {
      continue
    }

    if (seen.has(group.key) || deployedSiblings(id, groups, statuses).length > 0) {
      skip.add(id)
    }

    seen.add(group.key)
  }

  return skip
}

export async function deployStatuses(context: DeployContext): Promise<Map<string, DeployStatus>> {
  const manifests = await context.manifests.list()
  return new Map(manifests.map((manifest) => [manifest.modId, manifest.status]))
}

export async function deployAll(
  context: DeployContext,
  gamePath: string,
  targets: BulkTargets,
  groups: VersionGroup[]
): Promise<BulkResult> {
  const statuses = await deployStatuses(context)
  const library = context.library.list()
  const skip =
    typeof targets === 'string'
      ? versionsToSkip(groups, library, statuses)
      : pickedTwice(targets, groups, statuses)
  const mods = library.filter((mod) => inTargets(mod, targets) && !skip.has(mod.id))
  const ordered = [...mods.filter(isCoreMod), ...mods.filter((mod) => !isCoreMod(mod))]
  const pending = ordered.filter((mod) => statuses.get(mod.id) !== 'deployed')
  const deployable = pending.filter((mod) => !statuses.has(mod.id) && mod.plan.files.length > 0)

  return runEach(deployable, pending.length - deployable.length, async (mod) => {
    await deployMod(context, gamePath, mod)
    return []
  })
}

export async function purgeAll(context: DeployContext, targets: BulkTargets): Promise<BulkResult> {
  const statuses = await deployStatuses(context)
  const mods = context.library
    .list()
    .filter((mod) => inTargets(mod, targets) && statuses.has(mod.id))

  return runEach(mods, 0, async (mod) => (await undeployMod(context, mod)).kept)
}

export async function removeAll(
  context: DeployContext & RemoveContext,
  targets: BulkTargets
): Promise<BulkResult> {
  const mods = context.library.list().filter((mod) => inTargets(mod, targets))
  return runEach(mods, 0, async (mod) => (await undeployAndRemove(context, mod)).kept)
}
