import { execFile } from 'child_process'
import { promisify } from 'util'

//dummy password so encrypted archives don't hang forever
const NO_PASSWORD = '-pnone'

const execFileAsync = promisify(execFile)

const KNOWN_PROBLEMS: [RegExp, string][] = [
  [
    /Wrong password|Cannot open encrypted archive/i,
    "The archive is password-protected, so it can't be imported."
  ],
  [
    /Is not archive|Cannot open the file as/i,
    "This file isn't an archive 7-Zip can read. It may be damaged or only partly downloaded: try downloading it again."
  ],
  [
    /Unexpected end of archive|CRC Failed|Data Error|Headers Error/i,
    'The archive is damaged or incomplete. Try downloading it again.'
  ],
  [/not enough space/i, 'There is not enough free space on the disk.']
]

interface ExecFailure {
  code?: unknown
  killed?: unknown
  stdout?: unknown
  stderr?: unknown
}

function asFailure(error: unknown): ExecFailure {
  return typeof error === 'object' && error !== null ? error : {}
}

export function sevenZipError(error: unknown): Error {
  const { code, killed, stdout, stderr } = asFailure(error)
  const output = [stdout, stderr].filter((text) => typeof text === 'string').join('\n')

  let message: string
  if (code === 'ENOENT') {
    message = '7-Zip is missing from the app folder. Unzip NightCityModManager again.'
  } else if (killed === true) {
    message = '7-Zip took too long and was stopped.'
  } else {
    const known = KNOWN_PROBLEMS.find(([pattern]) => pattern.test(output))
    const errorLine = output.match(/^ERROR: (.+)$/m)?.[1]
    message =
      known?.[1] ??
      (errorLine
        ? `7-Zip could not open the archive: ${errorLine}`
        : `7-Zip could not open the archive (exit code ${String(code)}).`)
  }

  return new Error(message, { cause: error })
}

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
  try {
    const { stdout } = await execFileAsync(
      sevenZip,
      ['l', '-slt', '-sccUTF-8', NO_PASSWORD, '--', archive],
      {
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 60_000
      }
    )
    return parseListing(stdout)
  } catch (error) {
    throw sevenZipError(error)
  }
}

export async function extractArchive(
  sevenZip: string,
  archive: string,
  dest: string
): Promise<void> {
  try {
    await execFileAsync(
      sevenZip,
      ['x', '-sccUTF-8', '-y', '-bso0', '-bsp0', NO_PASSWORD, `-o${dest}`, '--', archive],
      { windowsHide: true, timeout: 30 * 60_000 }
    )
  } catch (error) {
    throw sevenZipError(error)
  }
}
