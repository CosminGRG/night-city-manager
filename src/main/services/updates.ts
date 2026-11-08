import type { ModRecord, ModUpdate, NexusFileRef } from '@shared/types'
import { parseArchiveName } from './archiveName'
import type { NexusFile, NexusFileCategory } from './nexus'

const GONE: NexusFileCategory[] = ['REMOVED', 'ARCHIVED']

interface KnownFile {
  mod: ModRecord
  file: NexusFile
  files: NexusFile[]
}

export function identifyFile(ref: NexusFileRef, files: NexusFile[]): NexusFile | null {
  const matches = files.filter((file) =>
    ref.kind === 'sqid' ? file.sqid === ref.sqid : file.uploadedAt === ref.uploadedAt
  )

  return matches.length === 1 ? matches[0] : null
}

export function newerFile(current: NexusFile, files: NexusFile[]): NexusFile | null {
  if (current.groupId === null) {
    return null
  }

  let newest: NexusFile | null = null
  for (const file of files) {
    if (file.groupId !== current.groupId || GONE.includes(file.category)) {
      continue
    }
    if (file.uploadedAt <= current.uploadedAt) {
      continue
    }
    if (!newest || file.uploadedAt > newest.uploadedAt) {
      newest = file
    }
  }

  return newest
}

function knownFile(mod: ModRecord, filesByMod: Record<number, NexusFile[]>): KnownFile | null {
  const ref = parseArchiveName(mod.archive).nexusFile
  const files = mod.nexusModId === null ? undefined : filesByMod[mod.nexusModId]
  if (!ref || !files) {
    return null
  }

  const file = identifyFile(ref, files)
  return file ? { mod, file, files } : null
}

export function findUpdates(
  mods: ModRecord[],
  filesByMod: Record<number, NexusFile[]>
): Record<string, ModUpdate> {
  const known = mods.map((mod) => knownFile(mod, filesByMod)).filter((entry) => entry !== null)
  const inLibrary = new Set(known.map(({ file }) => file.fileId))

  const updates: Record<string, ModUpdate> = {}
  for (const { mod, file, files } of known) {
    const newer = newerFile(file, files)
    if (newer && !inLibrary.has(newer.fileId)) {
      updates[mod.id] = {
        name: newer.name,
        version: newer.version,
        uploadedAt: new Date(newer.uploadedAt * 1000).toISOString()
      }
    }
  }

  return updates
}
