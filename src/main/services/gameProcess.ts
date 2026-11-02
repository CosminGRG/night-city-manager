import { execFile } from 'child_process'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const GAME_IMAGE = 'Cyberpunk2077.exe'

export function isImageListed(output: string, image: string): boolean {
  const field = `"${image.toLowerCase()}",`
  return output.split(/\r?\n/).some((line) => line.toLowerCase().startsWith(field))
}

export async function isGameRunning(): Promise<boolean> {
  const tasklist = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tasklist.exe')
  const { stdout } = await execFileAsync(
    tasklist,
    ['/FI', `IMAGENAME eq ${GAME_IMAGE}`, '/FO', 'CSV', '/NH'],
    { windowsHide: true, timeout: 10_000 }
  )

  return isImageListed(stdout, GAME_IMAGE)
}
