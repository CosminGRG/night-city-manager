import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Framework, ModRecord } from '@shared/types'
import { deployAll, purgeAll, removeAll } from './bulk'
import { deployMod, type DeployContext } from './deployer'
import { ModLibrary } from './modLibrary'
import { GameManifests } from './manifests'
import type { RemoveContext } from './removal'

let dir: string
let gamePath: string
let context: DeployContext & RemoveContext

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function staged(
  name: string,
  targets: string[],
  providers: Framework[] = []
): Promise<ModRecord> {
  const mod: ModRecord = {
    id: randomUUID(),
    name,
    version: null,
    nexusModId: null,
    archive: `${name}.zip`,
    folder: name,
    plan: {
      providers,
      files: targets.map((target) => ({ source: target, target })),
      types: [],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: new Date().toISOString()
  }
  await context.library.add(mod)
  for (const target of targets) await put(join(context.modsDir, name, target), name)
  return mod
}

async function deployed(
  name: string,
  target: string,
  providers: Framework[] = []
): Promise<ModRecord> {
  const mod = await staged(name, [target], providers)
  await deployMod(context, gamePath, mod)
  return mod
}

async function deployedIds(): Promise<string[]> {
  return (await context.manifests.list()).map((manifest) => manifest.modId)
}

const names = (mods: ModRecord[]): string[] => mods.map((mod) => mod.name)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-bulk-'))
  gamePath = join(dir, 'game')
  const games = new GameManifests(join(dir, 'data', 'manifests'))
  context = {
    modsDir: join(dir, 'mods'),
    backupsDir: join(dir, 'data', 'backups'),
    manifests: games.forGame(gamePath),
    library: new ModLibrary(join(dir, 'data', 'mods.json')),
    games
  }
  await put(join(gamePath, 'bin', 'x64', 'Cyberpunk2077.exe'), 'game')
  await mkdir(join(gamePath, 'archive', 'pc', 'mod'), { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('deployAll', () => {
  it('deploys core mods first, so they win a conflict', async () => {
    const fake = await staged('Fake Loader', ['bin/x64/version.dll'])
    const cet = await staged('CET', ['bin/x64/version.dll'], ['cet'])

    const result = await deployAll(context, gamePath, 'all', [])

    expect(result).toMatchObject({ done: 1, skipped: 0, failed: [{ name: fake.name }] })
    expect(result.failed[0].error).toMatch(/would overwrite files from CET/)
    expect(await deployedIds()).toEqual([cet.id])
  })

  it('skips mods with nothing to deploy and interrupted mods', async () => {
    await deployed('Already Deployed', 'archive/pc/mod/a.archive')
    await staged('Variants', [])
    const interrupted = await staged('Interrupted', ['archive/pc/mod/b.archive'])
    await context.manifests.write({
      version: 1,
      modId: interrupted.id,
      gamePath,
      status: 'deploying',
      files: [],
      folders: []
    })
    await staged('Fresh', ['archive/pc/mod/c.archive'])

    expect(await deployAll(context, gamePath, 'all', [])).toEqual({
      done: 1,
      skipped: 2,
      kept: [],
      failed: []
    })
  })

  it('deploys only core mods for the core scope', async () => {
    const cet = await staged('CET', ['bin/x64/plugins/cyber_engine_tweaks.asi'], ['cet'])
    await staged('Faster Elevators', ['archive/pc/mod/a.archive'])

    expect(await deployAll(context, gamePath, 'core', [])).toEqual({
      done: 1,
      skipped: 0,
      kept: [],
      failed: []
    })
    expect(await deployedIds()).toEqual([cet.id])
  })
})

describe('purgeAll', () => {
  it('undeploys every mod and leaves the game folder clean', async () => {
    await deployed('CET', 'bin/x64/plugins/cyber_engine_tweaks.asi', ['cet'])
    await deployed('Faster Elevators', 'archive/pc/mod/a.archive')

    expect(await purgeAll(context, 'all')).toEqual({ done: 2, skipped: 0, kept: [], failed: [] })
    expect(await deployedIds()).toEqual([])
    expect(await readdir(gamePath)).toEqual(['archive', 'bin'])
    expect(context.library.list()).toHaveLength(2)
  })

  it('keeps core mods deployed when purging non-core mods', async () => {
    const cet = await deployed('CET', 'bin/x64/plugins/cyber_engine_tweaks.asi', ['cet'])
    await deployed('Faster Elevators', 'archive/pc/mod/a.archive')

    expect(await purgeAll(context, 'non-core')).toMatchObject({ done: 1 })
    expect(await deployedIds()).toEqual([cet.id])
  })

  it('carries on when one mod fails and reports it', async () => {
    const broken = await deployed('Broken', 'archive/pc/mod/b.archive')
    await deployed('Faster Elevators', 'archive/pc/mod/a.archive')
    const manifest = await context.manifests.read(broken.id)
    if (!manifest) throw new Error('no manifest')
    await context.manifests.write({
      ...manifest,
      files: [{ path: '../outside.txt', source: 'x', method: 'link', backedUp: false }]
    })

    const result = await purgeAll(context, 'all')

    expect(result).toMatchObject({ done: 1, failed: [{ name: 'Broken' }] })
    expect(result.failed[0].error).toMatch(/outside the game folder/)
    expect(await deployedIds()).toEqual([broken.id])
  })
})

describe('removeAll', () => {
  it('undeploys and deletes every mod', async () => {
    await deployed('CET', 'bin/x64/plugins/cyber_engine_tweaks.asi', ['cet'])
    await staged('Not Deployed', ['archive/pc/mod/a.archive'])

    expect(await removeAll(context, 'all')).toEqual({ done: 2, skipped: 0, kept: [], failed: [] })
    expect(context.library.list()).toEqual([])
    expect(await readdir(context.modsDir)).toEqual([])
    expect(await readdir(gamePath)).toEqual(['archive', 'bin'])
  })

  it('keeps core mods when removing non-core mods', async () => {
    const cet = await deployed('CET', 'bin/x64/plugins/cyber_engine_tweaks.asi', ['cet'])
    await deployed('Faster Elevators', 'archive/pc/mod/a.archive')

    expect(await removeAll(context, 'non-core')).toMatchObject({ done: 1 })
    expect(names(context.library.list())).toEqual(['CET'])
    expect(await deployedIds()).toEqual([cet.id])
  })

  it('refuses to remove a mod that is deployed in another game folder', async () => {
    const elsewhere = await staged('Elsewhere', ['archive/pc/mod/b.archive'])
    const otherGame = join(dir, 'other-game')
    await context.games.forGame(otherGame).write({
      version: 1,
      modId: elsewhere.id,
      gamePath: otherGame,
      status: 'deployed',
      files: [],
      folders: []
    })
    await deployed('Here', 'archive/pc/mod/a.archive')

    const result = await removeAll(context, 'all')

    expect(result).toMatchObject({ done: 1, failed: [{ name: 'Elsewhere' }] })
    expect(result.failed[0].error).toMatch(/still deployed in .*other-game/)
    expect(names(context.library.list())).toEqual(['Elsewhere'])
  })
})

describe('deployAll with versions', () => {
  it('deploys one version per group, keeping the one already deployed', async () => {
    const newer = await staged('Mod 2.0', ['archive/pc/mod/a.archive'])
    const older = await staged('Mod 1.0', ['archive/pc/mod/a.archive'])
    const other = await staged('Other 2.0', ['archive/pc/mod/b.archive'])
    const otherOld = await deployed('Other 1.0', 'archive/pc/mod/b.archive')
    const groups = [
      { key: 'nexus:1', modIds: [newer.id, older.id] },
      { key: 'nexus:2', modIds: [other.id, otherOld.id] }
    ]

    expect(await deployAll(context, gamePath, 'all', groups)).toEqual({
      done: 1,
      skipped: 0,
      kept: [],
      failed: []
    })
    expect((await deployedIds()).toSorted()).toEqual([newer.id, otherOld.id].toSorted())
  })
})
