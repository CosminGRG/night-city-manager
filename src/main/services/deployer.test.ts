import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModRecord } from '@shared/types'
import { deployMod, type DeployContext } from './deployer'
import { ManifestStore } from './manifests'
import { ModLibrary } from './modLibrary'

let dir: string
let context: DeployContext

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

const game = (...parts: string[]): string => join(context.gamePath, ...parts)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-deploy-'))
  context = {
    gamePath: join(dir, 'game'),
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

    await deployMod(context, mod)

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

    await deployMod(context, mod)

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
    await deployMod(context, owner)

    await expect(deployMod(context, second)).rejects.toThrow(/Owner Mod/)
    expect(await readFile(game('archive', 'pc', 'mod', 'shared.archive'), 'utf8')).toBe('owner')
    expect(await context.manifests.read(second.id)).toBeNull()
  })

  it('refuses a mod that is already deployed', async () => {
    const mod = makeMod('A', [['a.archive', 'archive/pc/mod/a.archive']])
    await stage(mod, 'a')
    await deployMod(context, mod)

    await expect(deployMod(context, mod)).rejects.toThrow(/already deployed/)
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

    await expect(deployMod(context, mod)).rejects.toThrow()

    expect(await readFile(game('bin', 'x64', 'version.dll'), 'utf8')).toBe('manual install')
    expect(await exists(game('r6'))).toBe(false)
    expect(await context.manifests.read(mod.id)).toBeNull()
    expect(await exists(join(context.backupsDir, mod.id))).toBe(false)
  })
})
