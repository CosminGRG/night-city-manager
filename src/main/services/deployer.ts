import { rm } from 'fs/promises'
import { join, win32 } from 'path'
import type { ModRecord } from '@shared/types'
import { planDeploy, type DeployOperation } from './deployPlan'
import { backUp, backupPathFor, restore } from './backups'
import { missingFolders, removeEmptyFolders, removeEmptyTree } from './folders'
import type { ModLibrary } from './modLibrary'
import { findConflicts, type Manifest, type ManifestEntry, type ManifestStore } from './manifests'
import { linkOrCopy } from './place'

export interface DeployContext {
  gamePath: string
  modsDir: string
  backupsDir: string
  manifests: ManifestStore
  library: ModLibrary
}

export async function deployMod(context: DeployContext, mod: ModRecord): Promise<void> {
  const { gamePath, modsDir, backupsDir, manifests } = context
  if (await manifests.read(mod.id)) throw new Error(`${mod.name} is already deployed`)

  const operations = planDeploy(mod, join(modsDir, mod.folder), gamePath)
  await refuseConflicts(context, mod, operations)

  const backupDir = join(backupsDir, mod.id)
  const folders = await missingFolders(
    gamePath,
    operations.map((operation) => operation.target)
  )

  const files: ManifestEntry[] = operations.map((operation, index) => ({
    path: operation.path,
    source: mod.plan.files[index].source,
    method: null,
    backedUp: false
  }))

  const manifest: Manifest = {
    version: 1,
    modId: mod.id,
    gamePath,
    status: 'deploying',
    files,
    folders: folders.map((folder) => win32.relative(gamePath, folder).split(win32.sep).join('/'))
  }
  await manifests.write(manifest)

  try {
    for (const [index, operation] of operations.entries()) {
      files[index].backedUp = await backUp(
        operation.target,
        backupPathFor(backupDir, operation.path)
      )
      files[index].method = await linkOrCopy(operation.source, operation.target)
    }
  } catch (error) {
    await rollBack(operations, files, backupDir, error)
    await removeEmptyFolders(folders)
    await removeEmptyTree(backupDir)
    await manifests.remove(mod.id)
    throw error
  }

  await manifests.write({ ...manifest, status: 'deployed' })
}

async function refuseConflicts(
  context: DeployContext,
  mod: ModRecord,
  operations: DeployOperation[]
): Promise<void> {
  const { gamePath, manifests, library } = context
  const paths = operations.map((operation) => operation.path)
  const conflicts = findConflicts(paths, await manifests.list(), mod.id, gamePath)

  if (conflicts.length === 0) return

  const mods = library.list()
  const owners = new Set(
    conflicts.map(
      ({ ownerModId }) => mods.find((m) => m.id === ownerModId)?.name ?? 'an unknown mod'
    )
  )
  throw new Error(`${mod.name} would overwrite files from ${[...owners].join(', ')}.`)
}

async function rollBack(
  operations: DeployOperation[],
  files: ManifestEntry[],
  backupDir: string,
  cause: unknown
): Promise<void> {
  const failures: unknown[] = []

  for (let index = operations.length - 1; index >= 0; index--) {
    const { path, method, backedUp } = files[index]
    const { target } = operations[index]

    try {
      if (method) await rm(target, { force: true })
      if (backedUp) await restore(backupPathFor(backupDir, path), target)
    } catch (error) {
      failures.push(error)
    }
  }

  if (failures.length > 0) {
    throw new AggregateError([cause, ...failures], 'Deploy failed and could not be fully undone.')
  }
}
