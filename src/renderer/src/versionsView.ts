import type { DeployStatus, ModRecord, VersionGroup } from '@shared/types'
import { chooseVersion } from '@shared/versions'

export interface VersionRow {
  key: string
  mod: ModRecord
  versions: ModRecord[]
}

export interface VersionRows {
  rows: VersionRow[]
  skip: Set<string>
}

export function versionRows(
  mods: ModRecord[],
  groups: VersionGroup[],
  deployments: Record<string, DeployStatus>,
  picked: Record<string, string>
): VersionRows {
  const byId = new Map(mods.map((mod) => [mod.id, mod]))
  const groupOf = new Map<string, VersionGroup>()

  for (const group of groups) {
    for (const id of group.modIds) {
      groupOf.set(id, group)
    }
  }

  const hasStatus = (id: string): boolean => deployments[id] !== undefined
  const rows: VersionRow[] = []
  const skip = new Set<string>()
  const seen = new Set<string>()

  for (const mod of mods) {
    const group = groupOf.get(mod.id)
    if (!group) {
      rows.push({ key: `mod:${mod.id}`, mod, versions: [mod] })
      continue
    }

    if (seen.has(group.key)) {
      continue
    }
    seen.add(group.key)

    const versions = group.modIds.map((id) => byId.get(id)).filter((v) => v !== undefined)
    const ids = versions.map((version) => version.id)
    const chosen = chooseVersion(ids, versions, hasStatus)

    for (const id of ids) {
      if (id !== chosen) {
        skip.add(id)
      }
    }

    const shownId = ids.find(hasStatus) ?? ids.find((id) => id === picked[group.key]) ?? chosen
    const shown = versions.find((version) => version.id === shownId) ?? mod
    rows.push({ key: group.key, mod: shown, versions })
  }

  return { rows, skip }
}
