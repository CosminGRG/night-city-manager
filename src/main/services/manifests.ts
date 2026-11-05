import { readdir, rm } from 'fs/promises'
import { join, win32 } from 'path'
import { createHash } from 'crypto'
import type { DeployStatus } from '@shared/types'
import { readJsonFile, writeJsonFile } from './jsonFile'
import type { PlaceMethod } from './place'
import { isVanillaFolder } from './vanilla'
import { isBisectSession, type BisectSession } from './bisect'

export interface ManifestEntry {
  path: string
  source: string
  method: PlaceMethod | null
  backedUp: boolean
}

export interface Manifest {
  version: 1
  modId: string
  gamePath: string
  status: DeployStatus
  files: ManifestEntry[]
  folders: string[]
}

export interface Conflict {
  path: string
  ownerModId: string
}

const CREATED_FOLDERS = 'created-folders.json'
const KEPT_FILES = 'kept-files.json'
const BISECT = 'bisect.json'

const MOD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isManifest(data: unknown): data is Manifest {
  if (typeof data !== 'object' || data === null) return false
  const manifest = data as Manifest
  return (
    manifest.version === 1 &&
    typeof manifest.modId === 'string' &&
    typeof manifest.gamePath === 'string' &&
    Array.isArray(manifest.files) &&
    Array.isArray(manifest.folders)
  )
}

function isStringArray(data: unknown): data is string[] {
  return Array.isArray(data) && data.every((item) => typeof item === 'string')
}

export class ManifestStore {
  private readonly dir: string

  constructor(dir: string) {
    this.dir = dir
  }

  async read(modId: string): Promise<Manifest | null> {
    const data = await readJsonFile(this.fileFor(modId))
    return isManifest(data) ? data : null
  }

  async write(manifest: Manifest): Promise<void> {
    await writeJsonFile(this.fileFor(manifest.modId), manifest)
  }

  async remove(modId: string): Promise<void> {
    await rm(this.fileFor(modId), { force: true })
  }

  async list(): Promise<Manifest[]> {
    let names: string[]
    try {
      names = await readdir(this.dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const manifests: Manifest[] = []
    const files = names.filter((name) => name.endsWith('.json') && MOD_ID.test(name.slice(0, -5)))
    for (const name of files) {
      const data = await readJsonFile(join(this.dir, name))
      if (isManifest(data)) manifests.push(data)
    }

    return manifests
  }

  async createdFolders(): Promise<string[]> {
    const folders = (await this.readList(CREATED_FOLDERS)) ?? [
      ...new Set((await this.list()).flatMap((manifest) => manifest.folders))
    ]

    return folders.filter((folder) => !isVanillaFolder(folder))
  }

  async addCreatedFolders(folders: string[]): Promise<void> {
    await this.addToList(CREATED_FOLDERS, await this.createdFolders(), folders)
  }

  async setCreatedFolders(folders: string[]): Promise<void> {
    await writeJsonFile(join(this.dir, CREATED_FOLDERS), folders)
  }

  async keptFiles(): Promise<string[]> {
    return (await this.readList(KEPT_FILES)) ?? []
  }

  async addKeptFiles(paths: string[]): Promise<void> {
    await this.addToList(KEPT_FILES, await this.keptFiles(), paths)
  }

  async setKeptFiles(paths: string[]): Promise<void> {
    await writeJsonFile(join(this.dir, KEPT_FILES), paths)
  }

  async readBisect(): Promise<BisectSession | null> {
    const data = await readJsonFile(join(this.dir, BISECT))
    return isBisectSession(data) ? data : null
  }

  async writeBisect(session: BisectSession): Promise<void> {
    await writeJsonFile(join(this.dir, BISECT), session)
  }

  async removeBisect(): Promise<void> {
    await rm(join(this.dir, BISECT), { force: true })
  }

  private async readList(name: string): Promise<string[] | null> {
    const data = await readJsonFile(join(this.dir, name))
    return isStringArray(data) ? data : null
  }

  private async addToList(name: string, known: string[], items: string[]): Promise<void> {
    const seen = new Set(known.map((item) => item.toLowerCase()))
    const added = items.filter((item) => !seen.has(item.toLowerCase()))

    if (added.length > 0) {
      await writeJsonFile(join(this.dir, name), [...known, ...added])
    }
  }

  private fileFor(modId: string): string {
    if (!MOD_ID.test(modId)) throw new Error(`Invalid mod id: ${modId}`)
    return join(this.dir, `${modId}.json`)
  }
}

export function gameKey(gamePath: string): string {
  const normalized = win32.resolve(gamePath).toLowerCase()
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export class GameManifests {
  private readonly root: string

  constructor(root: string) {
    this.root = root
  }

  forGame(gamePath: string): ManifestStore {
    return new ManifestStore(join(this.root, gameKey(gamePath)))
  }

  private async stores(): Promise<ManifestStore[]> {
    let entries
    try {
      entries = await readdir(this.root, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => new ManifestStore(join(this.root, entry.name)))
  }

  async deployedIn(modId: string): Promise<string[]> {
    const gamePaths: string[] = []
    for (const store of await this.stores()) {
      const manifest = await store.read(modId)
      if (manifest) {
        gamePaths.push(manifest.gamePath)
      }
    }

    return gamePaths
  }

  async deployedGames(): Promise<string[]> {
    const gamePaths = new Set<string>()

    for (const store of await this.stores()) {
      for (const manifest of await store.list()) {
        gamePaths.add(manifest.gamePath)
      }
    }

    return [...gamePaths]
  }
}

export function findConflicts(
  paths: string[],
  manifests: Manifest[],
  modId: string,
  gamePath: string
): Conflict[] {
  const game = win32.resolve(gamePath).toLowerCase()
  const owners = new Map<string, string>()

  for (const manifest of manifests) {
    if (manifest.modId === modId) continue
    if (win32.resolve(manifest.gamePath).toLowerCase() !== game) continue
    for (const file of manifest.files) owners.set(file.path.toLowerCase(), manifest.modId)
  }

  return paths.flatMap((path) => {
    const owner = owners.get(path.toLowerCase())
    return owner ? [{ path, ownerModId: owner }] : []
  })
}
