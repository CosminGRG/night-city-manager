import { posix } from 'path'
import type { InstallPlan, ModType } from '@shared/types'

const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i

const DOC_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.pdf',
  '.html',
  '.url',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp'
])

const TYPE_PREFIXES: [string, ModType][] = [
  ['archive/pc/mod/', 'archive'],
  ['bin/x64/plugins/cyber_engine_tweaks/mods/', 'cet'],
  ['red4ext/plugins/', 'red4ext'],
  ['r6/scripts/', 'redscript'],
  ['r6/tweaks/', 'tweakxl'],
  ['r6/input/', 'input'],
  ['engine/config/', 'config'],
  ['mods/', 'redmod']
]

const ROOT_FOLDERS = new Set(['archive', 'bin', 'engine', 'mods', 'r6', 'red4ext'])

export interface ClassifyInput {
  files: string[]
  modName: string
}

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

export function detectType(target: string): ModType | null {
  const lower = target.toLowerCase()
  const match = TYPE_PREFIXES.find(([prefix]) => lower.startsWith(prefix))
  return match ? match[1] : null
}

function stripPrefix(file: string, prefix: string): string | null {
  if (prefix === '') return file
  return file.startsWith(`${prefix}/`) ? file.slice(prefix.length + 1) : null
}

function isUnderGameRoot(path: string): boolean {
  const [first, ...rest] = path.split('/')
  return ROOT_FOLDERS.has(first.toLowerCase()) && rest.length > 0
}

export function classify({ files }: ClassifyInput): InstallPlan {
  const plan: InstallPlan = { files: [], types: [], ignored: [], unmatched: [], warnings: [] }
  const sources = files.map(normalizePath).filter((file) => !JUNK.test(file))
  const prefixes = findRootPrefixes(sources)

  if (prefixes.size > 1) {
    plan.warnings.push(
      `This mod contains several variants (${[...prefixes].join(', ')}). Pick one manually.`
    )
    plan.unmatched = sources
    return plan
  }

  const prefix: string | null = prefixes.size === 1 ? [...prefixes][0] : null
  const types = new Set<ModType>()

  for (const source of sources) {
    const target = prefix === null ? null : stripPrefix(source, prefix)

    if (target !== null && isUnderGameRoot(target)) {
      plan.files.push({ source, target })
      const type = detectType(target)
      if (type) types.add(type)
    } else if (DOC_EXTENSIONS.has(posix.extname(source).toLowerCase())) {
      plan.ignored.push(source)
    } else {
      plan.unmatched.push(source)
    }
  }

  plan.types = [...types]
  return plan
}
