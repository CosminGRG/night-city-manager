import { constants } from 'fs'
import { copyFile, link, mkdir } from 'fs/promises'
import { dirname } from 'path'

export type PlaceMethod = 'link' | 'copy'

export async function linkOrCopy(source: string, target: string): Promise<PlaceMethod> {
  await mkdir(dirname(target), { recursive: true })

  try {
    await link(source, target)
    return 'link'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw error
  }

  await copyFile(source, target, constants.COPYFILE_EXCL)
  return 'copy'
}
