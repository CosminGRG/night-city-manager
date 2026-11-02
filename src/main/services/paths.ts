import { app } from 'electron'
import { dirname, join } from 'path'

export interface AppPaths {
  root: string
  data: string
  mods: string
  downloads: string
  sevenZip: string
}

export function resolveRoot(): string {
  if (!app.isPackaged) return join(app.getAppPath(), '.dev-data')
  return dirname(app.getPath('exe'))
}

function resolveSevenZip(): string {
  const resources = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
  return join(resources, '7zip', '7z.exe')
}

export function initPaths(): AppPaths {
  const root = resolveRoot()
  const paths: AppPaths = {
    root,
    data: join(root, 'data'),
    mods: join(root, 'mods'),
    downloads: join(root, 'downloads'),
    sevenZip: resolveSevenZip()
  }

  app.setPath('userData', paths.data)
  return paths
}
