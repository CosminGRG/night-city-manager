import { constants, type Stats } from 'fs'
import { copyFile, lstat, mkdir, rename, unlink } from 'fs/promises'
import { dirname, win32 } from 'path'
import { isInside } from './deployPlan'

async function lstatOrNull(path: string): Promise<Stats | null> {
  try {
    return await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export function backupPathFor(backupDir: string, path: string): string {
  const backup = win32.join(backupDir, path)
  if (!isInside(backupDir, backup)) {
    throw new Error(`Backup path "${path}" leaves the backup folder.`)
  }

  return backup
}

export async function moveFile(source: string, target: string): Promise<void> {
  if (await lstatOrNull(target)) throw new Error(`"${target}" already exists.`)
  await mkdir(dirname(target), { recursive: true })

  try {
    await rename(source, target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
    await copyFile(source, target, constants.COPYFILE_EXCL)
    await unlink(source)
  }
}

export async function backUp(target: string, backup: string): Promise<boolean> {
  const existing = await lstatOrNull(target)
  if (!existing) return false
  if (existing.isDirectory()) throw new Error(`"${target}" is a folder, not a file.`)

  await moveFile(target, backup)
  return true
}

export async function restore(backup: string, target: string): Promise<boolean> {
  if (!(await lstatOrNull(backup))) return false

  await moveFile(backup, target)
  return true
}
