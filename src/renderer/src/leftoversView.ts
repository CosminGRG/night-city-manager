import type { CleanResult, LeftoverGroup } from '@shared/types'

const UNITS = ['B', 'KB', 'MB', 'GB']

export function formatSize(bytes: number): string {
  let size = bytes
  let unit = 0

  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024
    unit++
  }

  return unit === 0 ? `${size} B` : `${size.toFixed(1)} ${UNITS[unit]}`
}

export function defaultSelection(groups: LeftoverGroup[]): Set<string> {
  return new Set(
    groups
      .filter((group) => !group.inUse)
      .flatMap((group) => group.files.filter((file) => !file.changed).map((file) => file.path))
  )
}

export function toggleItems(selected: Set<string>, paths: string[], on: boolean): Set<string> {
  const next = new Set(selected)
  for (const path of paths) {
    if (on) {
      next.add(path)
    } else {
      next.delete(path)
    }
  }

  return next
}

export function selectedTotals(
  groups: LeftoverGroup[],
  selected: Set<string>
): { count: number; size: number } {
  const files = groups.flatMap((group) => group.files).filter((file) => selected.has(file.path))

  return { count: files.length, size: files.reduce((sum, file) => sum + file.size, 0) }
}

export function cleanedAnything({ trashed, failed }: CleanResult): boolean {
  return trashed > 0 || failed.length > 0
}

export function cleanedMessage({ trashed, failed }: CleanResult): string {
  const parts = [
    `Moved ${trashed} leftover ${trashed === 1 ? 'file' : 'files'} to the Recycle Bin.`
  ]

  if (failed.length > 0) {
    parts.push(
      `Could not move: ${failed.map(({ path, error }) => `${path} (${error})`).join(', ')}`
    )
  }

  return parts.join(' ')
}
