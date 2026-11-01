import { rm } from 'fs/promises'
import type { ModRecord, UndeployResult } from '@shared/types'
import { stagingFolderFor } from './staging'
import { undeployMod, type DeployContext } from './deployer'

export type RemoveContext = Pick<DeployContext, 'modsDir' | 'manifests' | 'library'>

export async function removeMod(context: RemoveContext, mod: ModRecord): Promise<void> {
  const { modsDir, manifests, library } = context
  if (await manifests.read(mod.id))
    throw new Error(`${mod.name} is still deployed. Undeploy it first.`)

  const folder = stagingFolderFor(modsDir, mod)
  await library.remove(mod.id)
  await rm(folder, { recursive: true, force: true })
}

export async function undeployAndRemove(
  context: DeployContext,
  mod: ModRecord
): Promise<UndeployResult> {
  const deployed = (await context.manifests.read(mod.id)) !== null
  const result = deployed ? await undeployMod(context, mod) : { kept: [] }
  await removeMod(context, mod)
  return result
}
