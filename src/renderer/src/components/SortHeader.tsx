import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Sort, SortColumn } from '@renderer/modFilters'
import { useT } from '@renderer/i18n/context'
import './SortHeader.css'

interface SortHeaderProps {
  column: SortColumn
  label: string
  icon?: React.ReactNode
  sort: Sort | null
  onSort: (column: SortColumn) => void
}

export function SortHeader({
  column,
  label,
  icon,
  sort,
  onSort
}: SortHeaderProps): React.JSX.Element {
  const t = useT()
  const active = sort?.column === column
  const Arrow = sort?.descending ? ArrowDown : ArrowUp

  return (
    <button
      className={active ? 'sort-header active' : 'sort-header'}
      title={t('mods.sortBy', { column: label })}
      aria-label={t('mods.sortBy', { column: label })}
      onClick={() => onSort(column)}
    >
      {icon ?? label}
      {active && <Arrow size={12} aria-hidden="true" />}
    </button>
  )
}
