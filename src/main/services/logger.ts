import { appendFile, mkdir, rename, stat } from 'fs/promises'
import { dirname } from 'path'
import { createQueue } from './queue'

export type LogLevel = 'info' | 'warn' | 'error'

export interface Logger {
  info(message: string): void
  warn(message: string, error?: unknown): void
  error(message: string, error?: unknown): void
  flush(): Promise<void>
}

export interface LoggerOptions {
  home?: string
  maxBytes?: number
  now?: () => Date
}

const MAX_BYTES = 1024 * 1024

export function formatLine(level: LogLevel, message: string, now: Date): string {
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return `${date} ${time}.${pad(now.getMilliseconds(), 3)} [${level}] ${message}\n`
}

function ident(text: string): string {
  return text.replace(/\n/g, '\n ')
}

export function describeError(error: unknown, seen = new Set<unknown>()): string {
  if (!(error instanceof Error)) {
    return String(error)
  }
  if (seen.has(error)) {
    return `${error.name}: ${error.message} (see above)`
  }
  seen.add(error)

  const parts = [error.stack ?? `${error.name}: ${error.message}`]
  if (error instanceof AggregateError) {
    for (const inner of error.errors) {
      parts.push(`  includes: ${ident(describeError(inner, seen))}`)
    }
  }
  if (error.cause !== undefined) {
    parts.push(`  caused by: ${ident(describeError(error.cause, seen))}`)
  }

  return parts.join('\n')
}

export function hideHome(text: string, home: string): string {
  if (!home) {
    return text
  }

  let result = text
  for (const needle of new Set([home, home.replace(/\\/g, '/')])) {
    const lower = result.toLowerCase()
    const target = needle.toLowerCase()
    let output = ''
    let from = 0
    for (let at = lower.indexOf(target); at !== -1; at = lower.indexOf(target, from)) {
      output += result.slice(from, at) + '%USERPROFILE%'
      from = at + target.length
    }

    result = output + result.slice(from)
  }

  return result
}

export function oldLogPath(file: string): string {
  return file.replace(/\.log$/i, '') + '.old.log'
}

async function prepare(file: string, maxBytes: number): Promise<void> {
  try {
    await mkdir(dirname(file), { recursive: true })
    const { size } = await stat(file)
    if (size > maxBytes) {
      await rename(file, oldLogPath(file))
    }
  } catch {
    //no log yet or no access
  }
}

export function createFileLogger(file: string, options: LoggerOptions = {}): Logger {
  const { home = '', maxBytes = MAX_BYTES, now = () => new Date() } = options
  const queue = createQueue()
  let last: Promise<void> = queue(() => prepare(file, maxBytes))

  function write(level: LogLevel, message: string, error?: unknown): void {
    const text = error === undefined ? message : `${message}\n${describeError(error)}`
    const line = hideHome(formatLine(level, text, now()), home)
    last = queue(() => appendFile(file, line, 'utf8')).catch(() => {
      //line not written = lost. no crash from loggin
    })
  }

  return {
    info: (message) => write('info', message),
    warn: (message, error) => write('warn', message, error),
    error: (message, error) => write('error', message, error),
    flush: () => last
  }
}
