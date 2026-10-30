import { randomUUID } from 'crypto'
import { readdir, rm } from 'fs/promises'
import { basename } from 'path'
import type { ModRecord } from '@shared/types'
import { parseArchiveName } from './archiveName'
import { classify, isSafePath, normalizePath } from './classifier'
import { uniqueFolderName } from './folderName'
import type { ModLibrary } from './modLibrary'
import { listArchive } from './sevenZip'
import { stageArchive } from './staging'

export interface ImportContext {
  sevenZip: string
  modsDir: string
  library: ModLibrary
}

export async function importMod(context: ImportContext, archive: string): Promise<ModRecord> {
  const { sevenZip, modsDir, library } = context
  const archiveFile = basename(archive)
  const { name, version, nexusModId } = parseArchiveName(archiveFile)

  const files = await listArchive(sevenZip, archive)
  if (files.some((file) => !isSafePath(normalizePath(file)))) {
    throw new Error('This archive contains unsafe paths and was not imported.')
  }

  const plan = classify({ files, modName: name })
  const folder = uniqueFolderName(name, await listFolders(modsDir))
  const staged = await stageArchive(sevenZip, archive, modsDir, folder)

  const mod: ModRecord = {
    id: randomUUID(),
    name,
    version,
    nexusModId,
    archive: archiveFile,
    folder,
    plan,
    importedAt: new Date().toISOString()
  }

  try {
    await library.add(mod)
  } catch (error) {
    await rm(staged, { recursive: true, force: true })
    throw error
  }
  return mod
}

async function listFolders(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
