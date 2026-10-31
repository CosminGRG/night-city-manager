import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import type { PlaceMethod } from './place'

async function sameFile(a: string, b: string): Promise<boolean> {
  const [first, second] = await Promise.all([stat(a, { bigint: true }), stat(b, { bigint: true })])
  return first.dev === second.dev && first.ino === second.ino
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function sameContent(a: string, b: string): Promise<boolean> {
  const [first, second] = await Promise.all([stat(a), stat(b)])
  if (first.size !== second.size) return false

  const [firstHash, secondHash] = await Promise.all([hashFile(a), hashFile(b)])
  return firstHash === secondHash
}

export async function isOurFile(
  target: string,
  source: string,
  method: PlaceMethod | null
): Promise<boolean> {
  try {
    if (method !== 'copy' && (await sameFile(target, source))) return true
    if (method !== 'link' && (await sameContent(target, source))) return true
    return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}
