import type { ModRecord, VersionGroup } from '@shared/types'
import { deployStatuses } from './bulk'
import { deployMod, undeployMod, type DeployContext } from './deployer'
import { deployedSiblings } from './versions'

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
