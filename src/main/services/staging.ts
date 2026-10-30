import { randomUUID } from 'crypto'
import { readdir, rename, rm } from 'fs/promises'
import { join } from 'path'
import { extractArchive } from './sevenZip'

export async function findLinks(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isSymbolicLink())
    .map((entry) => join(entry.parentPath, entry.name))
}

export async function stageArchive(
  sevenZip: string,
  archive: string,
  modsDir: string,
  folderName: string
): Promise<string> {
  const temp = join(modsDir, `.tmp-${randomUUID()}`)
  const final = join(modsDir, folderName)

  try {
    await extractArchive(sevenZip, archive, temp)

    const links = await findLinks(temp)
    if (links.length > 0) throw new Error(`The archive contains links: ${links.join(', ')}`)

    await rename(temp, final)
    return final
  } catch (error) {
    await rm(temp, { recursive: true, force: true })
    throw error
  }
}
