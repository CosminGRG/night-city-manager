import { spawn } from 'child_process'
import { readdir } from 'fs/promises'
import { dirname, win32 } from 'path'
import type { ModRecord } from '@shared/types'
import { exists } from './folders'

const TIMEOUT_MS = 10 * 60 * 1000

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

export type RunProcess = (exe: string, args: string[]) => Promise<RunResult>

export function redModExe(gamePath: string): string {
  return win32.join(gamePath, 'tools', 'redmod', 'bin', 'redMod.exe')
}

export function redModFolders(mods: ModRecord[], deployed: (id: string) => boolean): string[] {
  const folders: string[] = []

  for (const mod of mods) {
    if (!deployed(mod.id)) {
      continue
    }

    for (const { target } of mod.plan.files) {
      const [root, folder, ...rest] = target.split('/')
      const known = folders.some((other) => other.toLowerCase() === folder?.toLowerCase())
      if (root.toLowerCase() === 'mods' && folder && rest.length > 0 && !known) {
        folders.push(folder)
      }
    }
  }

  return folders
}

export async function otherRedModFolders(gamePath: string, ours: string[]): Promise<string[]> {
  const modsDir = win32.join(gamePath, 'mods')
  const taken = new Set(ours.map((folder) => folder.toLowerCase()))

  let names: string[]
  try {
    const entries = await readdir(modsDir, { withFileTypes: true })
    names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  const found: string[] = []
  for (const name of names) {
    if (taken.has(name.toLowerCase())) {
      continue
    }
    if (await exists(win32.join(modsDir, name, 'info.json'))) {
      found.push(name)
    }
  }

  return found.toSorted((a, b) => a.localeCompare(b))
}

export function deployArgs(gamePath: string, folders: string[]): string[] {
  for (const value of [gamePath, ...folders]) {
    if (value.includes('"')) {
      throw new Error(`REDmod can't work with the name ${value}.`)
    }
  }

  return ['deploy', `-root="${gamePath}"`, ...folders.map((folder) => `-mod="${folder}"`)]
}

export function checkDeploy({ code, stdout, stderr }: RunResult): void {
  const misread = /No root specified|Invalid root path/.test(`${stdout}\n${stderr}`)
  if (code === 0 && stdout.includes('Commandlet deploy has succeeded.') && !misread) {
    return
  }

  const reason =
    stderr.trim().split(/\r?\n/)[0] ||
    (code === null ? 'it took too long and was stopped.' : `it stopped with exit code ${code}.`)

  throw new Error(`REDmod could not compile your mods: ${reason}`)
}

export function runRedMod(exe: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: dirname(exe),
      argv0: `"${exe}"`,
      windowsVerbatimArguments: true,
      windowsHide: true,
      timeout: TIMEOUT_MS
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    child.once('error', reject)
    child.once('close', (code) => resolve({ code, stdout, stderr }))
  })
}

export async function compileRedMods(
  gamePath: string,
  folders: string[],
  run: RunProcess = runRedMod
): Promise<void> {
  const exe = redModExe(gamePath)
  if (!(await exists(exe))) {
    throw new Error(
      `Your REDmod mods need the free REDmod DLC. Install it from your game store, then launch again.`
    )
  }

  checkDeploy(await run(exe, deployArgs(gamePath, folders)))
}

export async function prepareRedMods(
  gamePath: string,
  ours: string[],
  run: RunProcess = runRedMod
): Promise<string[]> {
  const folders = [...ours, ...(await otherRedModFolders(gamePath, ours))]
  if (folders.length === 0) {
    return []
  }

  await compileRedMods(gamePath, folders, run)
  return ['-modded']
}
