import { rm, unlink } from 'fs/promises'
import { join, win32 } from 'path'
import type { ModRecord, UndeployResult } from '@shared/types'
import { planDeploy, type DeployOperation } from './deployPlan'
import { backUp, backupPathFor, restore } from './backups'
import { missingFolders, removeEmptyFolders, removeEmptyTree, exists } from './folders'
import type { ModLibrary } from './modLibrary'
import { findConflicts, type Manifest, type ManifestEntry, type ManifestStore } from './manifests'
import { linkOrCopy } from './place'
import { isInside } from './deployPlan'
import { isOurFile } from './ownership'

export interface DeployContext {
  modsDir: string
  backupsDir: string
  manifests: ManifestStore
  library: ModLibrary
}

export async function deployMod(
  context: DeployContext,
  gamePath: string,
  mod: ModRecord
): Promise<void> {
  const { modsDir, backupsDir, manifests } = context
  if (!gamePath) throw new Error('Choose your game folder first.')
  if (await manifests.read(mod.id)) throw new Error(`${mod.name} is already deployed.`)

  const operations = planDeploy(mod, join(modsDir, mod.folder), gamePath)
  await refuseConflicts(context, gamePath, mod, operations)

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

export async function undeployMod(context: DeployContext, mod: ModRecord): Promise<UndeployResult> {
  const { modsDir, backupsDir, manifests } = context
  const manifest = await manifests.read(mod.id)
  if (!manifest) throw new Error(`${mod.name} is not deployed.`)

  await manifests.write({ ...manifest, status: 'undeploying' })

  const { gamePath } = manifest
  const stagingDir = join(modsDir, mod.folder)
  const backupDir = join(backupsDir, mod.id)
  const entries = [...manifest.files].reverse()
  const kept: string[] = []

  for (const [index, entry] of entries.entries()) {
    try {
      if (await undeployFile(entry, gamePath, stagingDir, backupDir)) kept.push(entry.path)
    } catch (error) {
      const remaining = entries.slice(index).reverse()
      await manifests.write({ ...manifest, status: 'undeploying', files: remaining })
      throw error
    }
  }

  await removeEmptyFolders(manifest.folders.map((folder) => gameFile(gamePath, folder)))
  await removeEmptyTree(backupDir)
  await manifests.remove(mod.id)
  return { kept }
}

async function undeployFile(
  entry: ManifestEntry,
  gamePath: string,
  stagingDir: string,
  backupDir: string
): Promise<boolean> {
  const target = gameFile(gamePath, entry.path)
  const source = win32.join(stagingDir, entry.source)

  if (await isOurFile(target, source, entry.method)) {
    await unlink(target)
  } else if (await exists(target)) {
    return true
  }

  await restore(backupPathFor(backupDir, entry.path), target)
  return false
}

function gameFile(gamePath: string, path: string): string {
  const file = win32.join(gamePath, path)
  if (!isInside(gamePath, file)) throw new Error(`"${path}" is outside the game folder.`)
  return file
}

async function refuseConflicts(
  context: DeployContext,
  gamePath: string,
  mod: ModRecord,
  operations: DeployOperation[]
): Promise<void> {
  const { manifests, library } = context
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
