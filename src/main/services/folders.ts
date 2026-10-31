import { rmdir } from 'fs/promises'

export async function removeEmptyFolders(folders: string[]): Promise<void> {
  const deepestFirst = [...folders].sort((a, b) => b.length - a.length)

  for (const folder of deepestFirst) {
    try {
      await rmdir(folder)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOTEMPTY' && code !== 'ENOENT') throw error
    }
  }
}
