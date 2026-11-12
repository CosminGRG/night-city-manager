import { join } from 'path'

export function systemTool(exe: string): string {
  return join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', exe)
}
