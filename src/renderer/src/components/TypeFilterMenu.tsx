import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, ListFilter } from 'lucide-react'
import type { TypeFilter } from '@renderer/modFilters'
import { MOD_TYPE_LABELS } from '@renderer/modLabels'
import { useT } from '@renderer/i18n/context'
import './Menu.css'
import './TypeFilterMenu.css'

const TYPE_FILTERS: TypeFilter[] = [
  'core',
  'archive',
  'archivexl',
  'redmod',
  'cet',
  'red4ext',
  'redscript',
  'tweakxl',
  'input',
  'config'
]

interface TypeFilterMenuProps {
  types: TypeFilter[]
  onChange: (types: TypeFilter[]) => void
}

export function TypeFilterMenu({ types, onChange }: TypeFilterMenuProps): React.JSX.Element {
  const t = useT()
  const label = (type: TypeFilter): string =>
    type === 'core' ? t('mods.core') : MOD_TYPE_LABELS[type]

  function toggle(type: TypeFilter, on: boolean): void {
    onChange(on ? [...types, type] : types.filter((item) => item !== type))
  }

  const summary =
    types.length === 0
      ? t('mods.typeFilter.all')
      : types.length === 1
        ? t('mods.typeFilter.one', { type: label(types[0]) })
        : t('mods.typeFilter.many', { count: types.length })

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={types.length > 0 ? 'small type-filter active' : 'small type-filter'}>
          <ListFilter size={14} aria-hidden="true" />
          {summary}
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align="end" sideOffset={4}>
          <DropdownMenu.Item
            className="menu-item"
            disabled={types.length === 0}
            onSelect={() => onChange([])}
          >
            {t('mods.typeFilter.clear')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="menu-separator" />
          {TYPE_FILTERS.map((type) => (
            <DropdownMenu.CheckboxItem
              key={type}
              className="menu-item"
              checked={types.includes(type)}
              onCheckedChange={(on) => toggle(type, on)}
              onSelect={(event) => event.preventDefault()}
            >
              <span className="menu-check">
                <DropdownMenu.ItemIndicator>
                  <Check size={14} aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </span>
              {label(type)}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
