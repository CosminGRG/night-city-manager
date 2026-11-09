import type { ModRecord } from './types'

export function chooseVersion(
  modIds: string[],
  mods: ModRecord[],
  hasStatus: (id: string) => boolean
): string {
  const hasFiles = (id: string): boolean =>
    mods.some((mod) => mod.id === id && mod.plan.files.length > 0)

  return modIds.find(hasStatus) ?? modIds.find(hasFiles) ?? modIds[0]
}
