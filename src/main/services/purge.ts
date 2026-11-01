import type { PurgeResult, PurgeScope } from '@shared/types'
import { isCoreMod } from '@shared/mods'
import { undeployMod, type DeployContext } from './deployer'

export async function purgeMods(context: DeployContext, scope: PurgeScope): Promise<PurgeResult> {
  const deployed = new Set((await context.manifests.list()).map((manifest) => manifest.modId))
  const targets = context.library
    .list()
    .filter((mod) => deployed.has(mod.id) && (scope === 'all' || !isCoreMod(mod)))

  const result: PurgeResult = { undeployed: 0, kept: [], failed: [] }

  for (const mod of targets) {
    try {
      const { kept } = await undeployMod(context, mod)
      result.undeployed++
      if (kept.length > 0) {
        result.kept.push({ name: mod.name, files: kept })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.failed.push({ name: mod.name, error: message })
    }
  }
  return result
}
