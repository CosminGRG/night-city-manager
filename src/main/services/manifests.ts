import { readdir, rm } from 'fs/promises'
import { join, win32 } from 'path'
import { readJsonFile, writeJsonFile } from './jsonFile'
import type { PlaceMethod } from './place'

export type DeployStatus = 'deploying' | 'deployed' | 'undeploying'

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
    for (const name of names.filter((name) => name.endsWith('.json'))) {
      const data = await readJsonFile(join(this.dir, name))
      if (isManifest(data)) manifests.push(data)
    }

    return manifests
  }

  private fileFor(modId: string): string {
    if (!MOD_ID.test(modId)) throw new Error(`Invalid mod id: ${modId}`)
    return join(this.dir, `${modId}.json`)
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
