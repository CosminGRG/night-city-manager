import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DeployStatus, Framework, ModRecord } from '@shared/types'
import { deployMod, type DeployContext } from './deployer'
import { GameManifests } from './manifests'
import { ModLibrary } from './modLibrary'
import {
  answerRound,
  applyRound,
  beginBisect,
  endBisect,
  getBisect,
  undoRound
} from './bisectSession'

let dir: string
let gamePath: string
let context: DeployContext
let mods: Record<'core' | 'a' | 'b' | 'c' | 'd', ModRecord>

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function deployed(name: string, providers: Framework[] = []): Promise<ModRecord> {
  const target = `archive/pc/mod/${name}.archive`
  const mod: ModRecord = {
    id: randomUUID(),
    name,
    version: null,
    nexusModId: null,
    archive: `${name}.zip`,
    folder: name,
    plan: {
      providers,
      files: [{ source: target, target }],
      types: [],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: new Date().toISOString()
  }
  await context.library.add(mod)
  await put(join(context.modsDir, name, target), name)
  await deployMod(context, gamePath, mod)
  return mod
}

async function deployedNames(): Promise<string[]> {
  const ids = new Set((await context.manifests.list()).map((manifest) => manifest.modId))
  return context.library
    .list()
    .filter((mod) => ids.has(mod.id))
    .map((mod) => mod.name)
}

async function setStatus(mod: ModRecord, status: DeployStatus): Promise<void> {
  const manifest = await context.manifests.read(mod.id)
  if (!manifest) throw new Error(`${mod.name} is not deployed`)
  await context.manifests.write({ ...manifest, status })
}

const ids = (...names: (keyof typeof mods)[]): string[] => names.map((name) => mods[name].id)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-bisect-'))
  gamePath = join(dir, 'game')
  context = {
    modsDir: join(dir, 'mods'),
    backupsDir: join(dir, 'data', 'backups'),
    manifests: new GameManifests(join(dir, 'data', 'manifests')).forGame(gamePath),
    library: new ModLibrary(join(dir, 'data', 'mods.json'))
  }
  await put(join(gamePath, 'bin', 'x64', 'Cyberpunk2077.exe'), 'game')
  await mkdir(join(gamePath, 'archive', 'pc', 'mod'), { recursive: true })

  mods = {
    core: await deployed('core', ['cet']),
    a: await deployed('a'),
    b: await deployed('b'),
    c: await deployed('c'),
    d: await deployed('d')
  }
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('beginBisect', () => {
  it('switches off the first half of the suspects in mod list order', async () => {
    const view = await beginBisect(context, gamePath, ids('d', 'c', 'b', 'a'), false)

    expect(view).toMatchObject({ total: 4, answered: 0, ready: true })
    expect(view.status).toMatchObject({ kind: 'testing', off: ids('a', 'b') })
    expect(await deployedNames()).toEqual(['core', 'c', 'd'])
  })

  it('refuses a second session, mods that are not deployed and interrupted mods', async () => {
    await beginBisect(context, gamePath, ids('a', 'b'), false)
    await expect(beginBisect(context, gamePath, ids('c', 'd'), false)).rejects.toThrow(
      /already running/
    )

    await endBisect(context, gamePath, false)
    await expect(
      beginBisect(context, gamePath, [...ids('a'), randomUUID()], false)
    ).rejects.toThrow(/deployed/)

    await setStatus(mods.c, 'undeploying')
    await expect(beginBisect(context, gamePath, ids('a', 'b'), false)).rejects.toThrow(
      /interrupted/
    )
  })
})

describe('rounds', () => {
  it('follows the answers and undoes the last one', async () => {
    await beginBisect(context, gamePath, ids('a', 'b', 'c', 'd'), false)

    const works = await answerRound(context, gamePath, 'works')
    expect(works.status).toMatchObject({ suspects: ids('a', 'b'), off: ids('a') })
    expect(await deployedNames()).toEqual(['core', 'b', 'c', 'd'])

    const undone = await undoRound(context, gamePath)
    expect(undone).toMatchObject({ answered: 0, ready: true })
    expect(await deployedNames()).toEqual(['core', 'c', 'd'])
  })

  it('leaves the mods as they are when the culprit is found', async () => {
    await beginBisect(context, gamePath, ids('a', 'b', 'c', 'd'), false)
    await answerRound(context, gamePath, 'broken')

    const found = await answerRound(context, gamePath, 'broken')
    expect(found.status).toEqual({ kind: 'found', culprit: mods.d.id })
    expect(await deployedNames()).toEqual(['core', 'a', 'b', 'd'])
  })

  it('notices when the mods no longer match the round, and applies it again', async () => {
    await beginBisect(context, gamePath, ids('a', 'b', 'c', 'd'), false)
    await deployMod(context, gamePath, mods.a)
    await setStatus(mods.c, 'deploying')

    expect(await getBisect(context)).toMatchObject({ ready: false })
    expect(await applyRound(context, gamePath)).toMatchObject({ ready: true })
    expect(await deployedNames()).toEqual(['core', 'c', 'd'])
    expect((await context.manifests.read(mods.c.id))?.status).toBe('deployed')
  })
})

describe('endBisect', () => {
  it('can keep the culprit off and switch the rest back on', async () => {
    await beginBisect(context, gamePath, ids('a', 'b', 'c', 'd'), false)
    await answerRound(context, gamePath, 'works')
    await answerRound(context, gamePath, 'works')

    await endBisect(context, gamePath, true)
    expect(await deployedNames()).toEqual(['core', 'b', 'c', 'd'])
    expect(await getBisect(context)).toBeNull()
  })

  it('restores every mod when stopped halfway', async () => {
    await beginBisect(context, gamePath, ids('a', 'b', 'c', 'd'), true)

    expect(await deployedNames()).toEqual(['core'])
    await endBisect(context, gamePath, true)
    expect(await deployedNames()).toEqual(['core', 'a', 'b', 'c', 'd'])
  })

  it('skips mods that were removed from the library meanwhile', async () => {
    await beginBisect(context, gamePath, ids('a', 'b', 'c', 'd'), false)
    await context.library.remove(mods.a.id)

    await endBisect(context, gamePath, false)
    expect(await deployedNames()).toEqual(['core', 'b', 'c', 'd'])
  })
})
