import { rm } from 'fs/promises'
import type { ModRecord } from '@shared/types'
import type { DeployContext } from './deployer'
import { stagingFolderFor } from './staging'

export type RemoveContext = Pick<DeployContext, 'modsDir' | 'manifests' | 'library'>

export async function removeMod(context: RemoveContext, mod: ModRecord): Promise<void> {
  const { modsDir, manifests, library } = context
  if (await manifests.read(mod.id))
    throw new Error(`${mod.name} is still deployed. Undeploy it first.`)

  const folder = stagingFolderFor(modsDir, mod)
  await library.remove(mod.id)
  await rm(folder, { recursive: true, force: true })
}
