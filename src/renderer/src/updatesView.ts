import type { DeployStatus, Framework, ModRecord, ModUpdate } from '@shared/types'
import type { Translate } from '@shared/i18n/translate'

export interface CoreUpdate {
  mod: ModRecord
  update: ModUpdate
}

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

export function updateTitle(
  { name, version, uploadedAt }: ModUpdate,
  t: Translate,
  language: string
): string {
  const day = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(uploadedAt))
  return t('updates.title', { version, name, day })
}
