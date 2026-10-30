import { win32 } from 'path'
import type { ModRecord } from '@shared/types'

export interface DeployOperation {
  path: string
  source: string
  target: string
}

export function isInside(root: string, path: string): boolean {
  const relative = win32.relative(root, path)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${win32.sep}`) &&
    !win32.isAbsolute(relative)
  )
}

export function planDeploy(mod: ModRecord, stagingDir: string, gameDir: string): DeployOperation[] {
  const seen = new Set<string>()

  return mod.plan.files.map((file) => {
    const operation: DeployOperation = {
      path: file.target,
      source: win32.join(stagingDir, file.source),
      target: win32.join(gameDir, file.target)
    }

    if (!isInside(stagingDir, operation.source) || !isInside(gameDir, operation.target)) {
      throw new Error(`${mod.name}: "${file.target}" would be placed outside its folder.`)
    }

    const key = file.target.toLowerCase()
    if (seen.has(key)) throw new Error(`${mod.name}: "${file.target}" is in the mod twice.`)
    seen.add(key)

    return operation
  })
}
