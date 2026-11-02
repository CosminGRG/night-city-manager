import { rmdir, lstat, readdir } from 'fs/promises'
import { join, win32 } from 'path'
import { isInside } from './deployPlan'

export async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function missingFolders(root: string, files: string[]): Promise<string[]> {
  const checked = new Set<string>()
  const missing: string[] = []

  for (const file of files) {
    for (let folder = win32.dirname(file); isInside(root, folder); folder = win32.dirname(folder)) {
      const key = folder.toLowerCase()
      if (checked.has(key)) break
      checked.add(key)
      if (await exists(folder)) break
      missing.push(folder)
    }
  }

  return missing
}

export async function removeEmptyTree(root: string): Promise<void> {
  let entries
  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(entry.parentPath, entry.name))

  await removeEmptyFolders([...folders, root])
}

export function deepestFirst(folders: string[]): string[] {
  return [...folders].sort((a, b) => b.length - a.length)
}

export async function removeIfEmpty(folder: string): Promise<boolean> {
  try {
    await rmdir(folder)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return true
    if (code === 'ENOTEMPTY') return false
    throw error
  }
}

export async function removeEmptyFolders(folders: string[]): Promise<void> {
  for (const folder of deepestFirst(folders)) {
    await removeIfEmpty(folder)
  }
}
