import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EN, MESSAGE_KEYS } from '@shared/i18n/en'
import { checkPack } from '@shared/i18n/pack'
import { makeZip, SEVEN_ZIP } from './testArchives'
import {
  addLanguage,
  addLanguages,
  englishTemplate,
  listLanguages,
  loadLanguage,
  MAX_PACK_BYTES,
  readPack
} from './languages'

let dir: string
let languages: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fixer-languages-'))
  languages = join(dir, 'languages')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function packJson(name: string, strings: Record<string, unknown> = {}): string {
  return JSON.stringify({ language: 'ro', name, author: 'V', fixer: '0.2.0', strings })
}

async function put(path: string, text: string): Promise<string> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
  return path
}

describe('readPack', () => {
  it('reads a pack, also with a byte order mark', async () => {
    const text = packJson('Română', { 'nav.mods': 'Moduri' })
    const path = await put(join(dir, 'ro.json'), `\uFEFF${text}`)

    expect((await readPack(path)).strings).toEqual({ 'nav.mods': 'Moduri' })
  })

  it('refuses broken JSON, other JSON and huge files', async () => {
    const broken = await put(join(dir, 'broken.json'), '{ "language": ')
    const other = await put(join(dir, 'other.json'), '{ "hello": "world" }')
    const huge = await put(join(dir, 'huge.json'), ' '.repeat(MAX_PACK_BYTES + 1))

    await expect(readPack(broken)).rejects.toThrow('broken.json is not valid JSON.')
    await expect(readPack(other)).rejects.toThrow('other.json is not a Fixer language file')
    await expect(readPack(huge)).rejects.toThrow('huge.json is too big')
  })
})

describe('listLanguages', () => {
  it('is empty when the folder does not exist', async () => {
    expect(await listLanguages(languages, vi.fn())).toEqual([])
  })

  it('lists valid packs by name and reports broken ones', async () => {
    await put(join(languages, 'ro.json'), packJson('Română', { 'nav.mods': 'Moduri' }))
    await put(join(languages, 'de.json'), packJson('Deutsch'))
    await put(join(languages, 'broken.json'), 'nope')
    await put(join(languages, 'notes.txt'), 'not a pack')
    const onError = vi.fn()

    const found = await listLanguages(languages, onError)

    expect(found.map((info) => info.file)).toEqual(['de.json', 'ro.json'])
    expect(found[1]).toEqual({
      file: 'ro.json',
      language: 'ro',
      name: 'Română',
      author: 'V',
      fixer: '0.2.0',
      complete: 1 / MESSAGE_KEYS.length
    })
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('broken.json', expect.any(Error))
  })
})

describe('loadLanguage', () => {
  it('loads a pack from the folder', async () => {
    await put(join(languages, 'ro.json'), packJson('Română'))
    expect((await loadLanguage(languages, 'ro.json')).name).toBe('Română')
  })

  it('refuses names that are not a file in the folder', async () => {
    await put(join(dir, 'outside.json'), packJson('Outside'))

    for (const file of ['..\\outside.json', '../outside.json', 'C:outside.json', 'ro.txt', 42]) {
      await expect(loadLanguage(languages, file)).rejects.toThrow('Choose a language')
    }
  })
})

describe('addLanguage', () => {
  it('copies a valid pack into the folder', async () => {
    const source = await put(join(dir, 'Downloads', 'ro.json'), packJson('Română'))

    const info = await addLanguage(languages, source)

    expect(info.file).toBe('ro.json')
    expect(await readFile(join(languages, 'ro.json'), 'utf8')).toBe(packJson('Română'))
  })

  it('copies nothing when the file is not a pack', async () => {
    const source = await put(join(dir, 'Downloads', 'ro.json'), '{}')

    await expect(addLanguage(languages, source)).rejects.toThrow('not a Fixer language file')
    expect(await listLanguages(languages, vi.fn())).toEqual([])
  })

  it('accepts a file that is already in the folder', async () => {
    const source = await put(join(languages, 'ro.json'), packJson('Română'))
    expect((await addLanguage(languages, source)).name).toBe('Română')
  })
})

describe('addLanguages', () => {
  it('adds a plain language file', async () => {
    const source = await put(join(dir, 'ro.json'), packJson('Română'))

    const added = await addLanguages(languages, source, SEVEN_ZIP)

    expect(added.map((info) => info.file)).toEqual(['ro.json'])
  })

  it('adds the language files inside an archive and skips the rest', async () => {
    const archive = await makeZip(dir, 'Romanian.zip', {
      'Fixer Romanian/ro.json': packJson('Română'),
      'Fixer Romanian/other.json': '{ "hello": "world" }',
      'Fixer Romanian/readme.txt': 'Thanks for downloading'
    })

    const added = await addLanguages(languages, archive, SEVEN_ZIP)

    expect(added.map((info) => info.file)).toEqual(['ro.json'])
    expect(await readFile(join(languages, 'ro.json'), 'utf8')).toBe(packJson('Română'))
    expect((await listLanguages(languages, vi.fn())).map((info) => info.file)).toEqual(['ro.json'])
  })

  it('refuses an archive without a language file', async () => {
    const archive = await makeZip(dir, 'Mod.zip', { 'archive/pc/mod/a.archive': 'x' })

    await expect(addLanguages(languages, archive, SEVEN_ZIP)).rejects.toThrow(
      'Mod.zip has no Fixer language file inside.'
    )
  })
})

describe('englishTemplate', () => {
  it('is a valid pack with every English message', () => {
    const pack = checkPack(JSON.parse(englishTemplate('0.2.0')))

    expect(pack).toMatchObject({ language: 'en', name: 'English', fixer: '0.2.0' })
    expect(pack?.strings).toEqual(EN)
  })
})
