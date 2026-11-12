import type { ModRecord, VersionGroup } from '@shared/types'
import { deployStatuses } from './bulk'
import { deployMod, undeployMod, type DeployContext } from './deployer'
import { deployedSiblings } from './versions'
import { undeployAndRemove, type RemoveContext } from './removal'

export interface RemovedVersion {
  deployed: boolean
  folders: string[]
  kept: string[]
}

export interface RemoveVersionsResult {
  removed: RemovedVersion[]
  deployedInstead: ModRecord | null
}

async function redeploy(
  context: DeployContext,
  gamePath: string,
  mods: ModRecord[]
): Promise<unknown[]> {
  const failures: unknown[] = []

  for (const mod of mods) {
    try {
      await deployMod(context, gamePath, mod)
    } catch (error) {
      failures.push(error)
    }
  }

  return failures
}

export async function deployVersion(
  context: DeployContext,
  gamePath: string,
  mod: ModRecord,
  groups: VersionGroup[]
): Promise<void> {
  const ids = deployedSiblings(mod.id, groups, await deployStatuses(context))
  const siblings = context.library.list().filter((other) => ids.includes(other.id))

  const undeployed: ModRecord[] = []

  try {
    for (const sibling of siblings) {
      await undeployMod(context, sibling)
      undeployed.push(sibling)
    }

    await deployMod(context, gamePath, mod)
  } catch (error) {
    const failures = await redeploy(context, gamePath, undeployed)

    if (failures.length > 0) {
      const names = undeployed.map((sibling) => sibling.name).join(', ')

      throw new AggregateError(
        [error, ...failures],
        `${mod.name} could not be deployed, and ${names} could not be deployed again.`,
        { cause: error }
      )
    }

    throw error
  }
}

export async function removeVersions(
  context: DeployContext & RemoveContext,
  gamePath: string,
  mod: ModRecord,
  others: ModRecord[],
  allVersions: boolean
): Promise<RemoveVersionsResult> {
  const wasDeployed = (await context.manifests.read(mod.id))?.status === 'deployed'
  const targets = allVersions ? [mod, ...others] : [mod]

  const removed: RemovedVersion[] = []
  for (const target of targets) {
    const manifest = await context.manifests.read(target.id)
    const { kept } = await undeployAndRemove(context, target)
    removed.push({ deployed: manifest !== null, folders: manifest?.folders ?? [], kept })
  }

  const replacement =
    wasDeployed && !allVersions ? others.find((other) => other.plan.files.length > 0) : undefined
  if (!replacement) {
    return { removed, deployedInstead: null }
  }

  try {
    await deployMod(context, gamePath, replacement)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${mod.name} was removed, but ${replacement.name} could not be deployed in its place: ${reason}`,
      { cause: error }
    )
  }

  return { removed, deployedInstead: replacement }
}
