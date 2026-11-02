import { readdir, rm } from 'fs/promises'
import { join, win32 } from 'path'
import { createHash } from 'crypto'
import { readJsonFile, writeJsonFile } from './jsonFile'
import type { PlaceMethod } from './place'
import type { DeployStatus } from '@shared/types'

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
    const data = await readJsonFile(join(this.dir, CREATED_FOLDERS))
    if (isStringArray(data)) return data
    return [...new Set((await this.list()).flatMap((manifest) => manifest.folders))]
  }

  async addCreatedFolders(folders: string[]): Promise<void> {
    const known = await this.createdFolders()
    const seen = new Set(known.map((folder) => folder.toLowerCase()))
    const added = folders.filter((folder) => !seen.has(folder.toLowerCase()))
    if (added.length > 0) {
      await this.setCreatedFolders([...known, ...added])
    }
  }

  async setCreatedFolders(folders: string[]): Promise<void> {
    await writeJsonFile(join(this.dir, CREATED_FOLDERS), folders)
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

  async deployedIn(modId: string): Promise<string[]> {
    let entries

    try {
      entries = await readdir(this.root, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const gamePath: string[] = []
    for (const entry of entries.filter((entry) => entry.isDirectory())) {
      const manifest = await new ManifestStore(join(this.root, entry.name)).read(modId)
      if (manifest) {
        gamePath.push(manifest.gamePath)
      }
    }

    return gamePath
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
