import { posix } from 'path'
import type { NexusFileRef } from '@shared/types'

const NEXUS_NAME = /^(.+) (\d+) (\S+) \d{4}-\d{2}-\d{2}T\d{2}-\d{2}Z (\S+)$/
const NEXUS_CLASSIC_NAME = /^(.+?)-(\d+)-(.+)-(\d{10})$/
const DOWNLOADED_AGAIN = / \(\d+\)$/

export interface ArchiveName {
  name: string
  version: string | null
  nexusModId: number | null
  nexusFile: NexusFileRef | null
}

export function sameNexusFile(a: NexusFileRef, b: NexusFileRef): boolean {
  if (a.kind === 'sqid' && b.kind === 'sqid') {
    return a.sqid === b.sqid
  }
  if (a.kind === 'uploaded' && b.kind === 'uploaded') {
    return a.uploadedAt === b.uploadedAt
  }

  return false
}

export function parseArchiveName(fileName: string): ArchiveName {
  const base = posix.parse(fileName).name
  const original = base.replace(DOWNLOADED_AGAIN, '')

  const current = original.match(NEXUS_NAME)
  if (current) {
    return {
      name: current[1],
      version: current[3],
      nexusModId: Number(current[2]),
      nexusFile: { kind: 'sqid', sqid: current[4] }
    }
  }

  const classic = original.match(NEXUS_CLASSIC_NAME)
  if (classic) {
    return {
      name: classic[1],
      version: classic[3].replace(/-/g, '.'),
      nexusModId: Number(classic[2]),
      nexusFile: { kind: 'uploaded', uploadedAt: Number(classic[4]) }
    }
  }

  return { name: base, version: null, nexusModId: null, nexusFile: null }
}
