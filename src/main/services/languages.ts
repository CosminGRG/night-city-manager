import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve, win32 } from 'path'
import { EN } from '@shared/i18n/en'
import { checkPack, completeness, type LanguagePack } from '@shared/i18n/pack'
import type { LanguageInfo } from '@shared/types'
import { extractArchive } from './sevenZip'
import { findLinks } from './staging'

export const MAX_PACK_BYTES = 1024 * 1024
const PACK_FILE = /\.json$/i

export async function readPack(path: string): Promise<LanguagePack> {
  const name = win32.basename(path)
  const info = await stat(path)

  if (!info.isFile()) {
    throw new Error(`${name} is not a file.`)
  }
  if (info.size > MAX_PACK_BYTES) {
    throw new Error(`${name} is too big for a language file.`)
  }

  let json: unknown
  try {
    json = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error(`${name} is not valid JSON.`, { cause: error })
  }

  const pack = checkPack(json)
  if (pack === null) {
    throw new Error(
      `${name} is not a Fixer language file: it needs a language, a name and strings.`
    )
  }

  return pack
}

function infoOf(file: string, pack: LanguagePack): LanguageInfo {
  const { language, name, author, fixer } = pack
  return { file, language, name, author, fixer, complete: completeness(pack.strings) }
}

export async function listLanguages(
  dir: string,
  onError: (file: string, error: unknown) => void
): Promise<LanguageInfo[]> {
  let files: string[]
  try {
    files = await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  const found: LanguageInfo[] = []
  for (const file of files.filter((name) => PACK_FILE.test(name))) {
    try {
      found.push(infoOf(file, await readPack(join(dir, file))))
    } catch (error) {
      onError(file, error)
    }
  }

  return found.sort((a, b) => a.name.localeCompare(b.name))
}

export function checkLanguageFile(file: unknown): string {
  if (typeof file !== 'string' || !PACK_FILE.test(file) || win32.basename(file) !== file) {
    throw new Error('Choose a language from the list.')
  }

  return file
}

export async function loadLanguage(dir: string, file: unknown): Promise<LanguagePack> {
  return readPack(join(dir, checkLanguageFile(file)))
}

export async function addLanguage(dir: string, source: string): Promise<LanguageInfo> {
  const pack = await readPack(source)
  const file = win32.basename(source)
  const target = join(dir, file)

  if (resolve(source).toLowerCase() !== resolve(target).toLowerCase()) {
    await mkdir(dir, { recursive: true })
    await copyFile(source, target)
  }

  return infoOf(file, pack)
}

async function packFilesIn(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && PACK_FILE.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

export async function addLanguages(
  dir: string,
  source: string,
  sevenZip: string
): Promise<LanguageInfo[]> {
  if (PACK_FILE.test(source)) {
    return [await addLanguage(dir, source)]
  }

  const name = win32.basename(source)
  const temp = await mkdtemp(join(tmpdir(), 'fixer-language-'))
  try {
    await extractArchive(sevenZip, source, temp)
    if ((await findLinks(temp)).length > 0) {
      throw new Error(`${name} contains links, which a language archive never needs.`)
    }

    const added: LanguageInfo[] = []
    for (const file of await packFilesIn(temp)) {
      try {
        added.push(await addLanguage(dir, file))
      } catch {
        //Some other JSON file
      }
    }

    if (added.length === 0) {
      throw new Error(`${name} has no Fixer language file inside.`)
    }

    return added
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

export function englishTemplate(fixerVersion: string): string {
  const template = { language: 'en', name: 'English', author: '', fixer: fixerVersion, strings: EN }
  return `${JSON.stringify(template, null, 2)}\n`
}
