import type { CleanResult, LeftoverGroup } from '@shared/types'
import type { Translate } from '@shared/i18n/translate'

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

export function cleanedMessage({ trashed, failed }: CleanResult, t: Translate): string {
  const parts = [t('leftovers.moved', { count: trashed })]

  if (failed.length > 0) {
    const files = failed.map(({ path, error }) => `${path} (${error})`).join(', ')
    parts.push(t('leftovers.notMoved', { files }))
  }

  return parts.join(' ')
}
