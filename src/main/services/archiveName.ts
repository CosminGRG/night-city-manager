import { posix } from 'path'

const NEXUS_NAME = /^(.+) (\d+) (\S+) \d{4}-\d{2}-\d{2}T\d{2}-\d{2}Z \S+$/
const NEXUS_CLASSIC_NAME = /^(.+?)-(\d+)-(.+)-\d{10}$/

export interface ArchiveName {
  name: string
  version: string | null
  nexusModId: number | null
}

export function parseArchiveName(fileName: string): ArchiveName {
  const base = posix.parse(fileName).name

  const current = base.match(NEXUS_NAME)
  if (current) return { name: current[1], version: current[3], nexusModId: Number(current[2]) }

  const classic = base.match(NEXUS_CLASSIC_NAME)
  if (classic) {
    return {
      name: classic[1],
      version: classic[3].replace(/-/g, '.'),
      nexusModId: Number(classic[2])
    }
  }

  return { name: base, version: null, nexusModId: null }
}
