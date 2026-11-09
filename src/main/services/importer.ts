import { randomUUID } from 'crypto'
import { readdir, rm } from 'fs/promises'
import { basename } from 'path'
import type { ImportOutcome, ModRecord } from '@shared/types'
import { parseArchiveName, sameNexusFile, type ArchiveName } from './archiveName'
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

export function findDuplicate(archive: ArchiveName, library: ModRecord[]): ModRecord | null {
  const { nexusModId, nexusFile } = archive
  if (nexusModId === null || nexusFile === null) {
    return null
  }

  const duplicate = library.find((mod) => {
    if (mod.nexusModId !== nexusModId) {
      return false
    }
    const other = parseArchiveName(mod.archive).nexusFile
    return other !== null && sameNexusFile(nexusFile, other)
  })

  return duplicate ?? null
}

export async function importMod(context: ImportContext, archive: string): Promise<ImportOutcome> {
  const { sevenZip, modsDir, library } = context
  const archiveFile = basename(archive)
  const parsed = parseArchiveName(archiveFile)
  const { name, version, nexusModId } = parsed

  const duplicate = findDuplicate(parsed, library.list())
  if (duplicate) {
    return { kind: 'duplicate', mod: duplicate }
  }

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

  return { kind: 'imported', mod }
}

async function listFolders(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
