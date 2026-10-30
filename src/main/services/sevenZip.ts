import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export function parseListing(stdout: string): string[] {
  const [, entries = ''] = stdout.replace(/\r\n/g, '\n').split(/^-{10}$/m)
  const files: string[] = []

  for (const block of entries.split('\n\n')) {
    const path = block.match(/^Path = (.+)$/m)?.[1]
    const isFolder = /^Folder = \+$/m.test(block) || /^Attributes = [A-Z]*D/m.test(block)
    if (path && !isFolder) files.push(path)
  }

  return files
}

export async function listArchive(sevenZip: string, archive: string): Promise<string[]> {
  const { stdout } = await execFileAsync(sevenZip, ['l', '-slt', '-sccUTF-8', '--', archive], {
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60_000
  })

  return parseListing(stdout)
}
