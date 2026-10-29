import { readdir, readFile, stat } from 'fs/promises'
import { join, resolve } from 'path'
import type { DetectedGame, GameStore } from '@shared/types'
import { readRegistryValue } from './registry'

const GAME_EXE = join('bin', 'x64', 'Cyberpunk2077.exe')

export async function isGameFolder(dir: string): Promise<boolean> {
  try {
    return (await stat(join(dir, GAME_EXE))).isFile()
  } catch {
    return false
  }
}

async function steamCandidates(): Promise<string[]> {
  const steamPath = await readRegistryValue('HKCU\\Software\\Valve\\Steam', 'SteamPath')
  if (!steamPath) return []

  const libraries = [steamPath]
  try {
    const vdf = await readFile(join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8')
    for (const match of vdf.matchAll(/"path"\s+"(.+?)"/g)) {
      libraries.push(match[1].replace(/\\\\/g, '\\'))
    }
  } catch {
    // no libraryfolders.vdf: only the main Steam folder is checked
  }

  return libraries.map((library) => join(library, 'steamapps', 'common', 'Cyberpunk 2077'))
}

async function gogCandidates(): Promise<string[]> {
  const path = await readRegistryValue(
    'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1423049311',
    'path'
  )
  return path ? [path] : []
}

async function epicCandidates(): Promise<string[]> {
  const programData = process.env.ProgramData ?? 'C:\\ProgramData'
  const manifestsDir = join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')

  let files: string[]
  try {
    files = await readdir(manifestsDir)
  } catch {
    return []
  }

  const candidates: string[] = []
  for (const file of files.filter((name) => name.endsWith('.item'))) {
    try {
      const manifest = JSON.parse(await readFile(join(manifestsDir, file), 'utf8'))
      if (typeof manifest.InstallLocation === 'string') candidates.push(manifest.InstallLocation)
    } catch {
      // unreadable manifest: skip it
    }
  }

  return candidates
}

const detectors: [GameStore, () => Promise<string[]>][] = [
  ['steam', steamCandidates],
  ['gog', gogCandidates],
  ['epic', epicCandidates]
]

export async function detectGames(): Promise<DetectedGame[]> {
  const found: DetectedGame[] = []
  const seen = new Set<string>()

  for (const [store, getCandidates] of detectors) {
    for (const candidate of await getCandidates()) {
      const path = resolve(candidate)
      const key = path.toLowerCase()
      if (seen.has(key) || !(await isGameFolder(path))) continue
      seen.add(key)
      found.push({ path, store })
    }
  }
  return found
}
