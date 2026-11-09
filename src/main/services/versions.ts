import type { ModRecord, VersionGroup, DeployStatus } from '@shared/types'
import { parseArchiveName } from './archiveName'
import type { NexusFile } from './nexus'
import { identifyFile } from './updates'

interface Placed {
  mod: ModRecord
  groupId: number | null
  uploadedAt: number | null
}

function place(mod: ModRecord, filesByMod: Record<number, NexusFile[]>): Placed {
  const ref = parseArchiveName(mod.archive).nexusFile
  const files = mod.nexusModId === null ? undefined : filesByMod[mod.nexusModId]
  const file = ref && files ? identifyFile(ref, files) : null

  const fromName = ref?.kind === 'uploaded' ? ref.uploadedAt : null

  return { mod, groupId: file?.groupId ?? null, uploadedAt: file?.uploadedAt ?? fromName }
}

function keyOf(placed: Placed, splitPages: Set<number>): string {
  const { mod, groupId } = placed
  if (mod.nexusModId === null) {
    return `mod:${mod.id}`
  }
  if (groupId !== null && splitPages.has(mod.nexusModId)) {
    return `nexus:${mod.nexusModId}:${groupId}`
  }
  return `nexus:${mod.nexusModId}`
}

function splitPagesOf(placed: Placed[]): Set<number> {
  const groupsByPage = new Map<number, Set<number>>()
  for (const { mod, groupId } of placed) {
    if (mod.nexusModId === null || groupId === null) {
      continue
    }

    const groups = groupsByPage.get(mod.nexusModId) ?? new Set<number>()
    groups.add(groupId)
    groupsByPage.set(mod.nexusModId, groups)
  }

  const split = [...groupsByPage].filter(([, groups]) => groups.size > 1)
  return new Set(split.map(([page]) => page))
}

function newestFirst(a: Placed, b: Placed): number {
  const time = (placed: Placed): number =>
    placed.uploadedAt ?? Date.parse(placed.mod.importedAt) / 1000

  return time(b) - time(a)
}

export function versionGroups(
  mods: ModRecord[],
  filesByMod: Record<number, NexusFile[]>
): VersionGroup[] {
  const placed = mods.map((mod) => place(mod, filesByMod))
  const splitPages = splitPagesOf(placed)

  const byKey = new Map<string, Placed[]>()
  for (const entry of placed) {
    const key = keyOf(entry, splitPages)
    byKey.set(key, [...(byKey.get(key) ?? []), entry])
  }

  return [...byKey].map(([key, members]) => ({
    key,
    modIds: members.toSorted(newestFirst).map(({ mod }) => mod.id)
  }))
}

export function deployedSiblings(
  modId: string,
  groups: VersionGroup[],
  statuses: Map<string, DeployStatus>
): string[] {
  const group = groups.find(({ modIds }) => modIds.includes(modId))
  return (group?.modIds ?? []).filter((id) => id !== modId && statuses.has(id))
}

export function versionsToSkip(
  groups: VersionGroup[],
  mods: ModRecord[],
  statuses: Map<string, DeployStatus>
): Set<string> {
  const hasFiles = (id: string): boolean =>
    mods.some((mod) => mod.id === id && mod.plan.files.length > 0)

  const skip = new Set<string>()
  for (const { modIds } of groups) {
    const chosen = modIds.find((id) => statuses.has(id)) ?? modIds.find(hasFiles) ?? modIds[0]

    for (const id of modIds) {
      if (id !== chosen) {
        skip.add(id)
      }
    }
  }

  return skip
}
