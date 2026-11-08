import { execFile, spawn, type SpawnOptions } from 'child_process'
import { join, dirname } from 'path'
import { promisify } from 'util'

export interface StartedProcess {
  once(event: 'spawn', listener: () => void): unknown
  once(event: 'error', listener: (error: Error) => void): unknown
  unref(): void
}

export type StartProcess = (
  command: string,
  args: string[],
  options: SpawnOptions
) => StartedProcess

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

export function launchExe(exe: string, start: StartProcess = spawn): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = start(exe, [], { cwd: dirname(exe), detached: true, stdio: 'ignore' })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
