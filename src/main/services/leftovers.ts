import { lstat, readdir } from 'fs/promises'
import { join, posix, win32 } from 'path'
import type { CleanResult, LeftoverGroup, LeftoverFile } from '@shared/types'
import { gameFile, removeEmptyCreatedFolders } from './deployer'
import { exists, removeEmptyTree } from './folders'
import { ManifestStore } from './manifests'
import { isVanillaFolder } from './vanilla'

export interface FoundFile {
  path: string
  size: number
}

export interface LeftoverInput {
  registered: string[]
  owned: string[]
  kept: string[]
  found: FoundFile[]
}

type LeftoverFilter = (group: LeftoverGroup, file: LeftoverFile) => boolean

function isUnder(folder: string, path: string): boolean {
  return path.toLowerCase().startsWith(`${folder.toLowerCase()}/`)
}

export function findLeftovers(input: LeftoverInput): LeftoverGroup[] {
  const owned = new Set(input.owned.map((path) => path.toLowerCase()))
  const kept = new Set(input.kept.map((path) => path.toLowerCase()))
  const nearestFirst = [...input.registered].sort((a, b) => b.length - a.length)
  const seen = new Set<string>()
  const groups = new Map<string, LeftoverGroup>()

  for (const file of input.found) {
    const key = file.path.toLowerCase()
    if (owned.has(key) || seen.has(key)) continue
    seen.add(key)

    const folder =
      nearestFirst.find((registered) => isUnder(registered, file.path)) ?? posix.dirname(file.path)

    let group = groups.get(folder.toLowerCase())
    if (!group) {
      const inUse = input.owned.some((path) => isUnder(folder, path))
      group = { folder, inUse, files: [] }
      groups.set(folder.toLowerCase(), group)
    }

    group.files.push({ path: file.path, size: file.size, changed: kept.has(key) })
  }

  for (const group of groups.values()) {
    group.files.sort((a, b) => a.path.localeCompare(b.path))
  }

  return [...groups.values()].sort((a, b) => a.folder.localeCompare(b.folder))
}

function topMost(folders: string[]): string[] {
  return folders.filter((folder) => !folders.some((other) => isUnder(other, folder)))
}

async function filesIn(gamePath: string, folder: string): Promise<FoundFile[]> {
  const root = gameFile(gamePath, folder)
  let entries

  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  const found: FoundFile[] = []
  for (const entry of entries.filter((entry) => entry.isFile())) {
    const file = join(entry.parentPath, entry.name)
    const path = win32.relative(gamePath, file).split(win32.sep).join('/')
    found.push({ path, size: (await lstat(file)).size })
  }

  return found
}

async function keptFilesOnDisk(gamePath: string, kept: string[]): Promise<FoundFile[]> {
  const found: FoundFile[] = []
  for (const path of kept) {
    const file = gameFile(gamePath, path)
    if (!(await exists(file))) continue
    const stats = await lstat(file)
    if (stats.isFile()) found.push({ path, size: stats.size })
  }

  return found
}

export async function scanLeftovers(
  manifests: ManifestStore,
  gamePath: string
): Promise<LeftoverGroup[]> {
  const registered = await manifests.createdFolders()
  const kept = await manifests.keptFiles()
  const owned = (await manifests.list()).flatMap((manifest) =>
    manifest.files.map((entry) => entry.path)
  )

  const found: FoundFile[] = []
  for (const folder of topMost(registered)) {
    found.push(...(await filesIn(gamePath, folder)))
  }
  found.push(...(await keptFilesOnDisk(gamePath, kept)))

  return findLeftovers({ registered, owned, kept, found })
}

export async function cleanLeftovers(
  manifests: ManifestStore,
  gamePath: string,
  paths: string[],
  trash: (file: string) => Promise<void>
): Promise<CleanResult> {
  const wanted = new Set(paths.map((path) => path.toLowerCase()))
  const groups = await scanLeftovers(manifests, gamePath)
  const registered = new Set((await manifests.createdFolders()).map((f) => f.toLowerCase()))
  const result: CleanResult = { trashed: 0, failed: [] }

  for (const group of groups) {
    const files = group.files.filter((file) => wanted.has(file.path.toLowerCase()))
    if (files.length === 0) continue

    for (const file of files) {
      try {
        await trash(gameFile(gamePath, file.path))
        result.trashed++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        result.failed.push({ path: file.path, error: message })
      }
    }

    if (!group.inUse && registered.has(group.folder.toLowerCase())) {
      await removeEmptyTree(gameFile(gamePath, group.folder))
    }
  }

  await removeEmptyCreatedFolders(manifests, gamePath)
  const kept: string[] = []

  for (const path of await manifests.keptFiles()) {
    if (await exists(gameFile(gamePath, path))) {
      kept.push(path)
    }
  }
  await manifests.setKeptFiles(kept)

  return result
}

async function cleanMatching(
  manifests: ManifestStore,
  gamePath: string,
  trash: (file: string) => Promise<void>,
  filter: LeftoverFilter
): Promise<CleanResult> {
  const groups = await scanLeftovers(manifests, gamePath)
  const paths = groups.flatMap((group) =>
    group.files
      .filter((file) => !isVanillaFolder(posix.dirname(file.path)) && filter(group, file))
      .map((file) => file.path)
  )

  return cleanLeftovers(manifests, gamePath, paths, trash)
}

export function cleanUnusedLeftovers(
  manifests: ManifestStore,
  gamePath: string,
  trash: (file: string) => Promise<void>
): Promise<CleanResult> {
  return cleanMatching(manifests, gamePath, trash, (group) => !group.inUse)
}

export function cleanModLeftovers(
  manifests: ManifestStore,
  gamePath: string,
  mod: { folders: string[]; kept: string[] },
  trash: (file: string) => Promise<void>
): Promise<CleanResult> {
  const folders = new Set(mod.folders.map((folder) => folder.toLowerCase()))
  const kept = new Set(mod.kept.map((path) => path.toLowerCase()))
  const filter: LeftoverFilter = (group, file) =>
    (!group.inUse && folders.has(group.folder.toLowerCase())) || kept.has(file.path.toLowerCase())

  return cleanMatching(manifests, gamePath, trash, filter)
}
