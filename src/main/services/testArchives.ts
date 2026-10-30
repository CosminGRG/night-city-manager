import { execFile } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const SEVEN_ZIP = join(process.cwd(), 'resources', '7zip', '7z.exe')

export async function makeZip(
  dir: string,
  name: string,
  files: Record<string, string>,
  password?: string
): Promise<string> {
  const src = join(dir, `src-${name}`)
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(src, path)), { recursive: true })
    await writeFile(join(src, path), content)
  }

  const zip = join(dir, name)
  const passwordArgs = password ? [`-p${password}`] : []
  await execFileAsync(SEVEN_ZIP, ['a', '-tzip', '-bso0', ...passwordArgs, zip, '*'], { cwd: src })
  return zip
}
