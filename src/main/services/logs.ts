import { posix, join, win32 } from 'path'
import type { Dirent } from 'fs'
import { lstat, readdir } from 'fs/promises'
import type { LogFile, LogSource, GameLogs } from '@shared/types'
import { gameFile } from './deployer'

export interface FoundLog {
  path: string
  size: number
  modifiedMs: number
}

export const LOG_ROOTS: { folder: string; source: LogSource }[] = [
  { folder: 'bin/x64/plugins/cyber_engine_tweaks', source: 'cet' },
  { folder: 'r6/logs', source: 'redscript' },
  { folder: 'red4ext', source: 'red4ext' }
]

const RUN_SUFFIX = /[-_]r?(?:current|\d{4}-\d{2}-\d{2}[-_]\d{2}-\d{2}-\d{2})(?=\.log$)/i

function isUnder(folder: string, path: string): boolean {
  return path.toLowerCase().startsWith(`${folder.toLowerCase()}/`)
}

export function logTitle(path: string): string {
  const name = posix.basename(path).replace(RUN_SUFFIX, '')
  return name.replace(/\.log$/i, '')
}

export function newestLogs(found: FoundLog[]): LogFile[] {
  const groups = new Map<string, FoundLog[]>()

  for (const file of found) {
    if (!/\.log$/i.test(file.path)) {
      continue
    }
    if (!LOG_ROOTS.some((root) => isUnder(root.folder, file.path))) {
      continue
    }

    const key = `${posix.dirname(file.path)}/${logTitle(file.path)}`.toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), file])
  }

  const logs: LogFile[] = []
  for (const files of groups.values()) {
    const newest = files.reduce((a, b) => (b.modifiedMs > a.modifiedMs ? b : a))
    const root = LOG_ROOTS.findIndex((root) => isUnder(root.folder, newest.path))

    logs.push({
      path: newest.path,
      title: logTitle(newest.path),
      source: LOG_ROOTS[root].source,
      modifiedAt: new Date(newest.modifiedMs).toISOString(),
      size: newest.size,
      older: files.length - 1
    })
  }

  const order = (log: LogFile): number => LOG_ROOTS.findIndex((root) => root.source === log.source)
  return logs.sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title))
}

async function readFolder(folder: string, recursive: boolean): Promise<Dirent[]> {
  try {
    return await readdir(folder, { recursive, withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function logsIn(gamePath: string, folder: string): Promise<FoundLog[]> {
  const found: FoundLog[] = []

  for (const entry of await readFolder(gameFile(gamePath, folder), true)) {
    if (!entry.isFile() || !/\.log$/i.test(entry.name)) {
      continue
    }

    const file = join(entry.parentPath, entry.name)
    const { size, mtimeMs } = await lstat(file)
    const path = win32.relative(gamePath, file).split(win32.sep).join('/')
    found.push({ path, size, modifiedMs: mtimeMs })
  }

  return found
}

async function gameLogs(gamePath: string): Promise<LogFile[]> {
  const found: FoundLog[] = []
  for (const root of LOG_ROOTS) {
    found.push(...(await logsIn(gamePath, root.folder)))
  }

  return newestLogs(found)
}

async function crashTimes(crashDir: string): Promise<number[]> {
  const times: number[] = []

  for (const entry of await readFolder(crashDir, false)) {
    if (entry.isDirectory()) {
      times.push((await lstat(join(crashDir, entry.name))).mtimeMs)
    }
  }

  return times
}

export async function scanLogs(gamePath: string, crashDir: string): Promise<GameLogs> {
  const crashes = await crashTimes(crashDir)

  return {
    logs: await gameLogs(gamePath),
    crashReports: crashes.length,
    lastCrashAt: crashes.length > 0 ? new Date(Math.max(...crashes)).toISOString() : null
  }
}

export async function findLog(gamePath: string, path: unknown): Promise<string> {
  if (typeof path !== 'string') {
    throw new Error('Invalid log.')
  }

  const logs = await gameLogs(gamePath)
  const log = logs.find((log) => log.path.toLowerCase() === path.toLowerCase())
  if (!log) {
    throw new Error('This los is no longer there. Refresh the list.')
  }

  return gameFile(gamePath, log.path)
}

export async function checkCrashReports(crashDir: string): Promise<string> {
  if ((await crashTimes(crashDir)).length === 0) {
    throw new Error('There are no crash reports.')
  }

  return crashDir
}
