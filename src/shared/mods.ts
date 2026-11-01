import type { ModRecord } from './types'

export function isCoreMod(mod: ModRecord): boolean {
  return mod.plan.providers.length > 0
}
