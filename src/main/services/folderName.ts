const INVALID_CHARS = /[<>:"/\\|?*\p{Cc}]/gu
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i
const MAX_LENGTH = 80

export function sanitizeFolderName(name: string): string {
  const folder = name
    .replace(INVALID_CHARS, '_')
    .slice(0, MAX_LENGTH)
    .replace(/^[. ]+|[. ]+$/g, '')

  if (folder === '') return 'mod'
  return RESERVED_NAME.test(folder) ? `_${folder}` : folder
}

export function uniqueFolderName(name: string, taken: string[]): string {
  const base = sanitizeFolderName(name)
  const used = new Set(taken.map((folder) => folder.toLowerCase()))

  let candidate = base
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    candidate = `${base} (${i})`
  }

  return candidate
}
