import { stat } from 'fs/promises'
import { join } from 'path'
import { DEPENDENCIES, KNOWN_DEPENDENCIES, type Dependency } from '@shared/requirements'

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

export async function detectInstalled(gamePath: string): Promise<Dependency[]> {
  const installed: Dependency[] = []
  for (const dependency of DEPENDENCIES) {
    if (await isFile(join(gamePath, KNOWN_DEPENDENCIES[dependency].file))) {
      installed.push(dependency)
    }
  }

  return installed
}
