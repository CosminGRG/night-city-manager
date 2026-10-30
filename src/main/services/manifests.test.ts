import { randomUUID } from 'crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findConflicts, ManifestStore, type Manifest } from './manifests'

const GAME = 'D:\\Games\\Cyberpunk2077'

function manifest(modId: string, paths: string[], gamePath = GAME): Manifest {
  return {
    version: 1,
    modId,
    gamePath,
    status: 'deployed',
    files: paths.map((path) => ({ path, method: 'link', backedUp: true }))
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
