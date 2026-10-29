import { app } from 'electron'
import { dirname, join } from 'path'
import { mkdir, unlink, writeFile } from 'fs/promises'

export interface AppPaths {
  root: string
  data: string
  mods: string
  downloads: string
}

export function resolveRoot(): string {
  if (!app.isPackaged) return join(app.getAppPath(), '.dev-data')
  return dirname(app.getPath('exe'))
}

export function initPaths(): AppPaths {
  const root = resolveRoot()
  const paths: AppPaths = {
    root,
    data: join(root, 'data'),
    mods: join(root, 'mods'),
    downloads: join(root, 'downloads')
  }

  app.setPath('userData', paths.data)
  return paths
}

export async function isWritable(dir: string): Promise<boolean> {
  const probe = join(dir, `.write-test-${process.pid}`)
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(probe, '')
    await unlink(probe)
    return true
  } catch {
    return false
  }
}
