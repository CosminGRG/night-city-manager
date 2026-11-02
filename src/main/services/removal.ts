import { rm } from 'fs/promises'
import { stagingFolderFor } from './staging'
import { undeployMod, type DeployContext } from './deployer'
import type { ModRecord, UndeployResult } from '@shared/types'
import type { GameManifests } from './manifests'
import type { ModLibrary } from './modLibrary'

export interface RemoveContext {
  modsDir: string
  library: ModLibrary
  games: GameManifests
}

export async function removeMod(context: RemoveContext, mod: ModRecord): Promise<void> {
  const { modsDir, library, games } = context
  const deployedIn = await games.deployedIn(mod.id)
  if (deployedIn.length > 0) {
    throw new Error(
      `${mod.name} is still deployed in ${deployedIn.join(', ')}. Undeploy it there first.`
    )
  }

  const folder = stagingFolderFor(modsDir, mod)
  await library.remove(mod.id)
  await rm(folder, { recursive: true, force: true })
}

export async function undeployAndRemove(
  context: DeployContext & RemoveContext,
  mod: ModRecord
): Promise<UndeployResult> {
  const deployed = (await context.manifests.read(mod.id)) !== null
  const result = deployed ? await undeployMod(context, mod) : { kept: [] }
  await removeMod(context, mod)
  return result
}
