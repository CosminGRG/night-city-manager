import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function readRegistryValue(key: string, value: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('reg', ['query', key, '/v', value], {
      windowsHide: true
    })
    const match = stdout.match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)/)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}
