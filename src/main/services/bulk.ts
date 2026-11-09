import type { BulkResult, BulkScope, DeployStatus, ModRecord, VersionGroup } from '@shared/types'
import { isCoreMod } from '@shared/mods'
import { deployMod, undeployMod, type DeployContext } from './deployer'
import { undeployAndRemove, type RemoveContext } from './removal'
import { versionsToSkip } from './versions'

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

function inScope(mod: ModRecord, scope: BulkScope): boolean {
  if (scope === 'all') return true
  return isCoreMod(mod) === (scope === 'core')
}

export async function deployStatuses(context: DeployContext): Promise<Map<string, DeployStatus>> {
  const manifests = await context.manifests.list()
  return new Map(manifests.map((manifest) => [manifest.modId, manifest.status]))
}

export async function deployAll(
  context: DeployContext,
  gamePath: string,
  scope: BulkScope,
  groups: VersionGroup[]
): Promise<BulkResult> {
  const statuses = await deployStatuses(context)
  const library = context.library.list()
  const skip = versionsToSkip(groups, library, statuses)
  const mods = library.filter((mod) => inScope(mod, scope) && !skip.has(mod.id))
  const ordered = [...mods.filter(isCoreMod), ...mods.filter((mod) => !isCoreMod(mod))]
  const pending = ordered.filter((mod) => statuses.get(mod.id) !== 'deployed')
  const targets = pending.filter((mod) => !statuses.has(mod.id) && mod.plan.files.length > 0)

  return runEach(targets, pending.length - targets.length, async (mod) => {
    await deployMod(context, gamePath, mod)
    return []
  })
}

export async function purgeAll(context: DeployContext, scope: BulkScope): Promise<BulkResult> {
  const statuses = await deployStatuses(context)
  const targets = context.library
    .list()
    .filter((mod) => inScope(mod, scope) && statuses.has(mod.id))

  return runEach(targets, 0, async (mod) => (await undeployMod(context, mod)).kept)
}

export async function removeAll(
  context: DeployContext & RemoveContext,
  scope: BulkScope
): Promise<BulkResult> {
  const targets = context.library.list().filter((mod) => inScope(mod, scope))
  return runEach(targets, 0, async (mod) => (await undeployAndRemove(context, mod)).kept)
}
