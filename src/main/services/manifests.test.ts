import { randomUUID } from 'crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findConflicts, ManifestStore, GameManifests, gameKey, type Manifest } from './manifests'

const GAME = 'D:\\Games\\Cyberpunk2077'

function manifest(modId: string, paths: string[], gamePath = GAME): Manifest {
  return {
    version: 1,
    modId,
    gamePath,
    status: 'deployed',
    files: paths.map((path) => ({ path, source: path, method: 'link', backedUp: true })),
    folders: []
  }
}

describe('ManifestStore', () => {
  let dir: string
  let store: ManifestStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ncm-manifests-'))
    store = new ManifestStore(join(dir, 'manifests'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes, reads and removes a manifest', async () => {
    const saved = manifest(randomUUID(), ['archive/pc/mod/a.archive'])

    await store.write(saved)
    expect(await store.read(saved.modId)).toEqual(saved)

    await store.remove(saved.modId)
    expect(await store.read(saved.modId)).toBeNull()
  })

  it('lists every manifest and skips files that are not manifeste', async () => {
    const a = manifest(randomUUID(), ['a'])
    const b = manifest(randomUUID(), ['b'])
    await store.write(a)
    await store.write(b)
    await writeFile(join(dir, 'manifests', 'notes.txt'), 'hello')
    await writeFile(join(dir, 'manifests', `${randomUUID()}.json`), '{ "something": "else" }')

    const listed = await store.list()
    expect(listed).toHaveLength(2)
    expect(listed).toEqual(expect.arrayContaining([a, b]))
  })

  it('lists nothing before the first deploy', async () => {
    expect(await store.list()).toEqual([])
  })

  it('refuses a modid that is not UUID', async () => {
    await expect(store.read('..\\..\\evil')).rejects.toThrow(/Invalid mod id/)
    await expect(store.write(manifest('../evil', []))).rejects.toThrow(/Invalid mod id/)
  })
})

describe('findConflicts', () => {
  const OWNER = randomUUID()
  const ME = randomUUID()

  it('names the mod that already owns a path, ignoring case', () => {
    const manifests = [manifest(OWNER, ['archive/pc/mod/shared.archive'])]
    expect(findConflicts(['Archive/PC/Mod/Shared.archive'], manifests, ME, GAME)).toEqual([
      { path: 'Archive/PC/Mod/Shared.archive', ownerModId: OWNER }
    ])
  })

  it('ignores manifests from another game folder', () => {
    const manifests = [manifest(OWNER, ['archive/pc/mod/a.archive'], 'E:\\Other\\Cyberpunk 2077')]
    expect(findConflicts(['archive/pc/mod/a.archive'], manifests, ME, GAME)).toEqual([])
  })

  it('finds nothing when no path is owned', () => {
    const manifests = [manifest(OWNER, ['archive/pc/mod/other.archive'])]
    expect(findConflicts(['archive/pc/mod/a.archive'], manifests, ME, GAME)).toEqual([])
  })
})

describe('gameKey', () => {
  it('is the same for different spellings of one folder', () => {
    expect(gameKey('C:\\Games\\Cyberpunk 2077')).toBe(gameKey('c:/games/cyberpunk 2077/'))
  })

  it('differs between folders and is a short hex string', () => {
    expect(gameKey('C:\\Games\\Cyberpunk 2077')).not.toBe(gameKey('D:\\Games\\Cyberpunk 2077'))
    expect(gameKey('C:\\Games\\Cyberpunk 2077')).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('GameManifests', () => {
  let root: string
  let games: GameManifests

  const manifestFor = (modId: string, gamePath: string): Manifest => ({
    version: 1,
    modId,
    gamePath,
    status: 'deployed',
    files: [],
    folders: []
  })

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ncm-games-'))
    games = new GameManifests(join(root, 'manifests'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('keeps the manifests of each game folder apart', async () => {
    const modId = randomUUID()
    await games.forGame('C:\\Fake').write(manifestFor(modId, 'C:\\Fake'))

    expect(await games.forGame('C:\\Fake').list()).toHaveLength(1)
    expect(await games.forGame('E:\\Real').list()).toEqual([])
  })

  it('finds every game folder a mod is deployed in', async () => {
    const modId = randomUUID()
    await games.forGame('C:\\Fake').write(manifestFor(modId, 'C:\\Fake'))
    await games.forGame('E:\\Real').write(manifestFor(modId, 'E:\\Real'))

    expect((await games.deployedIn(modId)).sort()).toEqual(['C:\\Fake', 'E:\\Real'])
    expect(await games.deployedIn(randomUUID())).toEqual([])
  })

  it('finds nothing before the first deploy', async () => {
    expect(await games.deployedIn(randomUUID())).toEqual([])
  })
})

describe('created folders', () => {
  let dir: string
  let store: ManifestStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ncm-created-'))
    store = new ManifestStore(join(dir, 'manifests'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('remembers created folders and skips case duplicates', async () => {
    await store.addCreatedFolders(['r6/scripts', 'r6'])
    await store.addCreatedFolders(['R6/Scripts', 'red4ext'])
    expect(await store.createdFolders()).toEqual(['r6/scripts', 'r6', 'red4ext'])
  })

  it('starts from the folders recorded in existing manifests', async () => {
    await store.write({ ...manifest(randomUUID(), []), folders: ['r6/scripts', 'r6'] })
    await store.write({ ...manifest(randomUUID(), []), folders: ['red4ext'] })
    expect((await store.createdFolders()).sort()).toEqual(['r6', 'r6/scripts', 'red4ext'])
  })

  it('does not list its own file as a manifest', async () => {
    await store.write(manifest(randomUUID(), []))
    await store.setCreatedFolders(['r6'])
    expect(await store.list()).toHaveLength(1)
  })
})
