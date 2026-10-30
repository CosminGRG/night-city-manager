import { stat } from 'fs/promises'
import { join } from 'path'
import type { Framework } from '@shared/types'
import { FRAMEWORK_FILES } from './classifier'

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

export async function detectInstalledFrameworks(gamePath: string): Promise<Framework[]> {
  const installed: Framework[] = []
  for (const [file, framework] of FRAMEWORK_FILES) {
    if (await isFile(join(gamePath, file))) installed.push(framework)
  }

  return installed
}
