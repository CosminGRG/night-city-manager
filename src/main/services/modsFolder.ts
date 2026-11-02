import { cp, mkdir, readdir, rename, rm } from 'fs/promises'
import { win32 } from 'path'
import type { ModRecord } from '@shared/types'
import { isInside } from './deployPlan'
import { exists, isWritable, removeIfEmpty } from './folders'
import { stagingFolderFor } from './staging'

function samePath(a: string, b: string): boolean {
  return win32.resolve(a).toLowerCase() === win32.resolve(b).toLowerCase()
}

function overlaps(a: string, b: string): boolean {
  return samePath(a, b) || isInside(a, b) || isInside(b, a)
}

export function sameDrive(a: string, b: string): boolean {
  const drive = (path: string): string => win32.parse(win32.resolve(path)).root.toLowerCase()
  return drive(a) === drive(b)
}

export async function checkNewModsFolder(
  target: string,
  current: string,
  gamePath: string | null
): Promise<void> {
  if (samePath(target, current)) {
    throw new Error('This is already your mods folder.')
  }
  if (overlaps(target, current)) {
    throw new Error('Choose a folder that is not insside your current mods folder.')
  }
  if (gamePath && overlaps(target, gamePath)) {
    throw new Error('Choose a folder outside the game folder.')
  }
  if ((await exists(target)) && (await readdir(target)).length > 0) {
    throw new Error('Choose an empty folder.')
  }
  if (!(await isWritable(target))) {
    throw new Error(`"${target}" can't be written to.`)
  }
}

async function renameModFolders(from: string, to: string, mods: ModRecord[]): Promise<ModRecord[]> {
  const moved: ModRecord[] = []
  try {
    for (const mod of mods) {
      const source = stagingFolderFor(from, mod)
      if (!(await exists(source))) continue
      await rename(source, stagingFolderFor(to, mod))
      moved.push(mod)
    }

    return mods
  } catch (error) {
    await renameBack(from, to, moved)
    throw error
  }
}

async function renameBack(from: string, to: string, moved: ModRecord[]): Promise<void> {
  for (const mod of [...moved].reverse()) {
    await rename(stagingFolderFor(to, mod), stagingFolderFor(from, mod)).catch(() => {
      //folder stays in the new place
    })
  }
}

export async function copyModFolders(from: string, to: string, mods: ModRecord[]): Promise<void> {
  const copied: string[] = []
  try {
    for (const mod of mods) {
      const source = stagingFolderFor(from, mod)
      if (!(await exists(source))) continue
      const target = stagingFolderFor(to, mod)
      copied.push(target)
      await cp(source, target, { recursive: true, errorOnExist: true, force: false })
    }
  } catch (error) {
    await removeFolders(copied)
    throw error
  }
}

async function removeFolders(folders: string[]): Promise<void> {
  for (const folder of folders) {
    await rm(folder, { recursive: true, force: true })
  }
}

export async function moveMods(
  from: string,
  to: string,
  mods: ModRecord[],
  commit: () => Promise<void>
): Promise<void> {
  await mkdir(to, { recursive: true })
  if (sameDrive(from, to)) {
    const moved = await renameModFolders(from, to, mods)
    try {
      await commit()
    } catch (error) {
      await renameBack(from, to, moved)
      throw error
    }
  } else {
    await copyModFolders(from, to, mods)
    try {
      await commit()
    } catch (error) {
      await removeFolders(mods.map((mod) => stagingFolderFor(to, mod)))
      throw error
    }
    await removeFolders(mods.map((mod) => stagingFolderFor(from, mod)))
  }
  await removeIfEmpty(from)
}
