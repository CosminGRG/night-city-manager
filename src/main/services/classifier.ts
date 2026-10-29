const ROOT_FOLDERS = new Set(['archive', 'bin', 'engine', 'mods', 'r6', 'red4ext'])

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\/+/, '')
}

export function findRootPrefixes(files: string[]): Set<string> {
  const prefixes = new Set<string>()

  for (const file of files) {
    const segments = file.split('/')
    const index = segments.findIndex((segment) => ROOT_FOLDERS.has(segment.toLowerCase()))
    if (index !== -1 && index < segments.length - 1) {
      prefixes.add(segments.slice(0, index).join('/'))
    }
  }

  return prefixes
}
