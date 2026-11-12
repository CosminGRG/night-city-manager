import { execFile, spawn, type SpawnOptions } from 'child_process'
import { readFile } from 'fs/promises'
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

export const STEAM_APP_ID = '1091500'

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

//Steam starts the games with their app id, without it the game's Steam
//connection fails and will not connect to CDPR
export function launchEnvironment(config: unknown): Record<string, string> {
  const platform =
    typeof config === 'object' && config !== null && 'platform' in config ? config.platform : null

  if (platform !== 'steam') {
    return {}
  }

  return { SteamAppId: STEAM_APP_ID, SteamGameId: STEAM_APP_ID }
}

export async function readLaunchEnvironment(gamePath: string): Promise<Record<string, string>> {
  try {
    const text = await readFile(join(gamePath, 'launcher-configuration.json'), 'utf8')
    return launchEnvironment(JSON.parse(text))
  } catch {
    return {}
  }
}

export function launchExe(
  exe: string,
  args: string[],
  env: Record<string, string>,
  start: StartProcess = spawn
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = start(exe, args, {
      cwd: dirname(exe),
      env: { ...process.env, ...env },
      detached: true,
      stdio: 'ignore'
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
