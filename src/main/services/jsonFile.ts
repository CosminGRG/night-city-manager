import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'

export async function readJsonFile(filePath: string): Promise<unknown> {
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }

  try {
    return JSON.parse(raw)
  } catch {
    await rename(filePath, `${filePath}.corrupt`)
    return null
  }
}

const writes = new Map<string, Promise<void>>()

export function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const previous = writes.get(filePath) ?? Promise.resolve()
  const next = previous
    .catch(() => {
      //a failed earlier write was already reported to its own caller
    })
    .then(() => writeNow(filePath, data))

  writes.set(filePath, next)
  return next
}

const LOCKED = new Set(['EPERM', 'EACCES', 'EBUSY'])
const RETRY_DELAYS_MS = [50, 100, 200, 400, 800]

async function replaceFile(from: string, to: string): Promise<void> {
  for (const delay of RETRY_DELAYS_MS) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      if (!LOCKED.has((error as NodeJS.ErrnoException).code ?? '')) throw error
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  await rename(from, to)
}

async function writeNow(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8')
  await replaceFile(tempPath, filePath)
}
