import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile, readdir, rename } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join, relative } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModRecord } from '@shared/types'
import { deployMod, undeployMod, type DeployContext } from './deployer'
import { ManifestStore } from './manifests'
import { ModLibrary } from './modLibrary'

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name)
    result[relative(root, path)] = entry.isDirectory() ? '<folder>' : await readFile(path, 'utf8')
  }
  return result
}

const SAMPLE: [source: string, target: string][] = [
  ['bin/x64/version.dll', 'bin/x64/version.dll'],
  [
    'bin/x64/plugins/cyber_engine_tweaks/mods/M/init.lua',
    'bin/x64/plugins/cyber_engine_tweaks/mods/M/init.lua'
  ],
  ['r6/scripts/M/a.reds', 'r6/scripts/M/a.reds'],
  ['archive/pc/mod/m.archive', 'archive/pc/mod/m.archive']
]

let dir: string
let context: DeployContext
let gamePath: string

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function makeMod(name: string, files: [source: string, target: string][]): ModRecord {
  return {
    id: randomUUID(),
    name,
    version: null,
    nexusModId: null,
    archive: `${name}.zip`,
    folder: name,
    plan: {
      providers: [],
      files: files.map(([source, target]) => ({ source, target })),
      types: [],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: new Date().toISOString()
  }
}

async function stage(mod: ModRecord, content: string): Promise<void> {
  for (const { source } of mod.plan.files)
    await put(join(context.modsDir, mod.folder, source), content)
}

const game = (...parts: string[]): string => join(gamePath, ...parts)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-deploy-'))
  gamePath = join(dir, 'game')
  context = {
    modsDir: join(dir, 'mods'),
    backupsDir: join(dir, 'data', 'backups'),
    manifests: new ManifestStore(join(dir, 'data', 'manifests')),
    library: new ModLibrary(join(dir, 'data', 'mods.json'))
  }
  await put(game('bin', 'x64', 'Cyberpunk2077.exe'), 'game')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('deployMod', () => {
  it('places the files and records them in a deployed manifest', async () => {
    const mod = makeMod('Faster Elevators', [
      ['archive/pc/mod/a.archive', 'archive/pc/mod/a.archive']
    ])
    await stage(mod, 'mod data')

    await deployMod(context, gamePath, mod)

    expect(await readFile(game('archive', 'pc', 'mod', 'a.archive'), 'utf8')).toBe('mod data')
    expect(await context.manifests.read(mod.id)).toMatchObject({
      status: 'deployed',
      files: [{ path: 'archive/pc/mod/a.archive', method: 'link', backedUp: false }],
      folders: ['archive/pc/mod', 'archive/pc', 'archive']
    })
  })

  it('backs up a file that is not from any mod', async () => {
    const mod = makeMod('CET', [['bin/x64/version.dll', 'bin/x64/version.dll']])
    await stage(mod, 'ours')
    await put(game('bin', 'x64', 'version.dll'), 'manual install')

    await deployMod(context, gamePath, mod)

    expect(
      await readFile(join(context.backupsDir, mod.id, 'bin', 'x64', 'version.dll'), 'utf8')
    ).toBe('manual install')
    expect((await context.manifests.read(mod.id))?.files[0].backedUp).toBe(true)
  })

  it('refuses to overwrite a file owned by another mod, naming it', async () => {
    const owner = makeMod('Owner Mod', [['a.archive', 'archive/pc/mod/shared.archive']])
    const second = makeMod('Second Mod', [['b.archive', 'archive/pc/mod/Shared.archive']])
    await context.library.add(owner)
    await stage(owner, 'owner')
    await stage(second, 'second')
    await deployMod(context, gamePath, owner)

    await expect(deployMod(context, gamePath, second)).rejects.toThrow(/Owner Mod/)
    expect(await readFile(game('archive', 'pc', 'mod', 'shared.archive'), 'utf8')).toBe('owner')
    expect(await context.manifests.read(second.id)).toBeNull()
  })

  it('refuses a mod that is already deployed', async () => {
    const mod = makeMod('A', [['a.archive', 'archive/pc/mod/a.archive']])
    await stage(mod, 'a')
    await deployMod(context, gamePath, mod)

    await expect(deployMod(context, gamePath, mod)).rejects.toThrow(/already deployed/)
  })

  it('undoes everything when a file fails halfway', async () => {
    const mod = makeMod('Broken', [
      ['bin/x64/version.dll', 'bin/x64/version.dll'],
      ['r6/scripts/Broken/a.reds', 'r6/scripts/Broken/a.reds'],
      ['missing.reds', 'r6/scripts/Broken/b.reds']
    ])
    await put(join(context.modsDir, mod.folder, 'bin', 'x64', 'version.dll'), 'ours')
    await put(join(context.modsDir, mod.folder, 'r6', 'scripts', 'Broken', 'a.reds'), 'reds')
    await put(game('bin', 'x64', 'version.dll'), 'manual install')

    await expect(deployMod(context, gamePath, mod)).rejects.toThrow()

    expect(await readFile(game('bin', 'x64', 'version.dll'), 'utf8')).toBe('manual install')
    expect(await exists(game('r6'))).toBe(false)
    expect(await context.manifests.read(mod.id)).toBeNull()
    expect(await exists(join(context.backupsDir, mod.id))).toBe(false)
  })
})

describe('undeployMod', () => {
  beforeEach(async () => {
    await put(game('bin', 'x64', 'version.dll'), 'manual install')
    await mkdir(game('r6', 'scripts'), { recursive: true })
  })

  it('round trip: the game folder ends up exactly as before', async () => {
    const before = await snapshot(gamePath)
    const mod = makeMod('M', SAMPLE)
    await stage(mod, 'mod')
    await deployMod(context, gamePath, mod)
    expect(await snapshot(gamePath)).not.toEqual(before)

    expect(await undeployMod(context, mod)).toEqual({ kept: [] })
    expect(await snapshot(gamePath)).toEqual(before)
    expect(await context.manifests.read(mod.id)).toBeNull()
    expect(await snapshot(context.backupsDir)).toEqual({})
  })

  it('keeps a file that changed after deploy and a folder that gained files', async () => {
    const mod = makeMod('M', SAMPLE)
    await stage(mod, 'mod')
    await deployMod(context, gamePath, mod)
    const settings = game(
      'bin',
      'x64',
      'plugins',
      'cyber_engine_tweaks',
      'mods',
      'M',
      'settings.json'
    )
    await put(settings, '{}')
    const reds = game('r6', 'scripts', 'M', 'a.reds')
    await writeFile(`${reds}.tmp`, 'edited by the user')
    await rename(`${reds}.tmp`, reds)

    expect(await undeployMod(context, mod)).toEqual({ kept: ['r6/scripts/M/a.reds'] })
    expect(await readFile(reds, 'utf8')).toBe('edited by the user')
    expect(await readFile(settings, 'utf8')).toBe('{}')
    expect(await readFile(game('bin', 'x64', 'version.dll'), 'utf8')).toBe('manual install')
  })

  it('finishes a deploy that crashed halfway', async () => {
    const before = await snapshot(gamePath)
    const mod = makeMod('M', SAMPLE)
    await stage(mod, 'mod')
    await deployMod(context, gamePath, mod)
    const manifest = await context.manifests.read(mod.id)
    if (!manifest) throw new Error('expected a manifest')
    await context.manifests.write({
      ...manifest,
      status: 'deploying',
      files: manifest.files.map((file) => ({ ...file, method: null, backedUp: false }))
    })

    await undeployMod(context, mod)
    expect(await snapshot(gamePath)).toEqual(before)
  })

  it('refuses a mod that is not deployed', async () => {
    await expect(undeployMod(context, makeMod('M', SAMPLE))).rejects.toThrow(/not deployed/)
  })
})

describe('created folders', () => {
  it('removes a shared folder once the last mod using it is undeployed', async () => {
    const first = makeMod('First', [['r6/scripts/first.reds', 'r6/scripts/first.reds']])
    const second = makeMod('Second', [['r6/scripts/second.reds', 'r6/scripts/second.reds']])
    for (const mod of [first, second]) {
      await stage(mod, mod.name)
      await deployMod(context, gamePath, mod)
    }

    await undeployMod(context, first)
    expect(await exists(game('r6', 'scripts', 'second.reds'))).toBe(true)

    await undeployMod(context, second)
    expect(await exists(game('r6'))).toBe(false)
    expect(await context.manifests.createdFolders()).toEqual([])
  })

  it('keeps a created folder that holds a file no mod placed', async () => {
    const mod = makeMod('Mod', [['r6/scripts/mod.reds', 'r6/scripts/mod.reds']])
    await stage(mod, 'mod')
    await deployMod(context, gamePath, mod)
    await writeFile(game('r6', 'scripts', 'settings.json'), '{}')

    await undeployMod(context, mod)

    expect(await exists(game('r6', 'scripts', 'settings.json'))).toBe(true)
    expect((await context.manifests.createdFolders()).sort()).toEqual(['r6', 'r6/scripts'])
  })
})
