import type { ModRecord, VersionGroup } from '@shared/types'

export function rootOf(mod: ModRecord, byId: Map<string, ModRecord>): ModRecord {
  const seen = new Set<string>()
  let current = mod

  while (current.nexusModId === null && current.versionOf !== undefined) {
    const next = byId.get(current.versionOf)

    if (!next || seen.has(next.id)) {
      break
    }

    seen.add(current.id)
    current = next
  }

  return current
}

export function linkedTo(modId: string, mods: ModRecord[]): string[] {
  const ids = [modId]

  for (let i = 0; i < ids.length; i++) {
    for (const mod of mods) {
      if (mod.versionOf === ids[i] && !ids.includes(mod.id)) {
        ids.push(mod.id)
      }
    }
  }

  return ids
}

export function checkVersionLink(
  mod: ModRecord,
  target: ModRecord | null,
  mods: ModRecord[],
  groups: VersionGroup[],
  deployed: (id: string) => boolean
): void {
  if (mod.nexusModId !== null) {
    throw new Error(`${mod.name} has a Nexus archive name, so its versions come from the name.`)
  }

  if (target === null) {
    return
  }

  const moving = linkedTo(mod.id, mods)
  if (moving.includes(target.id)) {
    throw new Error(`${target.name} is already a version of ${mod.name}.`)
  }

  const joining = groups.find((group) => group.modIds.includes(target.id))?.modIds ?? [target.id]
  const nameOf = (id: string): string => mods.find((other) => other.id === id)?.name ?? id
  const deployedMoving = moving.find(deployed)
  const deployedJoining = joining.filter((id) => !moving.includes(id)).find(deployed)

  if (deployedMoving !== undefined && deployedJoining !== undefined) {
    throw new Error(
      `Only one version of a mod can be deployed. Undeploy ${nameOf(deployedMoving)} or ${nameOf(deployedJoining)} first.`
    )
  }
}

export function afterRemoval(mods: ModRecord[], removeId: string): ModRecord[] {
  const removed = mods.find((mod) => mod.id === removeId)
  const rest = mods.filter((mod) => mod.id !== removeId)
  const children = rest.filter((mod) => mod.versionOf === removeId)

  if (!removed || children.length === 0) {
    return rest
  }

  const sibling =
    removed.nexusModId === null
      ? undefined
      : rest.find((mod) => mod.nexusModId === removed.nexusModId)
  const target = removed.versionOf ?? sibling?.id ?? children[0].id

  return rest.map((mod) => {
    if (mod.versionOf !== removeId) {
      return mod
    }

    return { ...mod, versionOf: mod.id === target ? undefined : target }
  })
}
