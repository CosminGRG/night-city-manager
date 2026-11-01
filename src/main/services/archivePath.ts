import { stat } from 'fs/promises'
import { win32 } from 'path'

export const ARCHIVE_EXTENSIONS = ['.zip', '.7z', '.rar']

export async function checkArchivePath(path: unknown): Promise<string> {
  if (typeof path !== 'string') {
    throw new Error('The archive path must be a string.')
  }
  if (!/^[a-z]:[\\/]/i.test(path)) {
    throw new Error(`"${path}" is not a full path on a local drive.`)
  }
  const archive = win32.normalize(path)
  if (!ARCHIVE_EXTENSIONS.includes(win32.extname(archive).toLowerCase())) {
    throw new Error(`"${win32.basename(archive)}" is not a .zip, .7z or .rar archive.`)
  }

  const info = await stat(archive).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (!info) {
    throw new Error(`"${archive}" was not found.`)
  }
  if (!info.isFile()) {
    throw new Error(`"${archive}" is not a file.`)
  }
  return archive
}
