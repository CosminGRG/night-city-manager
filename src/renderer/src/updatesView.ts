import type { DeployStatus, Framework, ModRecord, ModUpdate } from '@shared/types'

export interface CoreUpdate {
  mod: ModRecord
  update: ModUpdate
}

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})

export function coreUpdates(
  mods: ModRecord[],
  deployments: Record<string, DeployStatus>,
  updates: Record<string, ModUpdate>
): Partial<Record<Framework, CoreUpdate>> {
  const result: Partial<Record<Framework, CoreUpdate>> = {}

  for (const mod of mods) {
    const update = updates[mod.id]
    if (!update || deployments[mod.id] !== 'deployed') {
      continue
    }

    for (const framework of mod.plan.providers) {
      result[framework] ??= { mod, update }
    }
  }

  return result
}

export function updateTitle({ name, version, uploadedAt }: ModUpdate): string {
  const day = dayFormat.format(new Date(uploadedAt))
  return `Update available: ${version} ("${name}"), uploaded ${day}. Click to see its files on Nexus Mods.`
}
