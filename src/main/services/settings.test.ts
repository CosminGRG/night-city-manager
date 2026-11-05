import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SettingsStore } from './settings'

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-settings-'))
  file = join(dir, 'settings.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('SettingsStore', () => {
  it('turns the Nexus lookup on for settings saved before it existed', async () => {
    await writeFile(file, JSON.stringify({ version: 1, gamePath: 'E:\\Game' }))
    const store = new SettingsStore(file)
    await store.load()

    expect(store.get()).toMatchObject({ gamePath: 'E:\\Game', nexusLookup: true })
  })

  it('replaces a Nexus lookup value that is not a boolean', async () => {
    await writeFile(file, JSON.stringify({ version: 1, nexusLookup: 'no' }))
    const store = new SettingsStore(file)
    await store.load()

    expect(store.get().nexusLookup).toBe(true)
  })

  it('keeps the choice after a restart', async () => {
    const store = new SettingsStore(file)
    await store.update({ nexusLookup: false })

    const reloaded = new SettingsStore(file)
    await reloaded.load()
    expect(reloaded.get().nexusLookup).toBe(false)
  })
})
