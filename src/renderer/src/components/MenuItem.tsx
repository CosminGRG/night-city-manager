import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { LucideIcon } from 'lucide-react'
import './Menu.css'

interface MenuItemProps {
  icon: LucideIcon
  children: React.ReactNode
  disabled?: boolean
  danger?: boolean
  onSelect?: () => void
}

export function MenuItem({
  icon: Icon,
  children,
  disabled,
  danger,
  onSelect
}: MenuItemProps): React.JSX.Element {
  return (
    <DropdownMenu.Item
      className={danger ? 'menu-item danger' : 'menu-item'}
      disabled={disabled}
      onSelect={onSelect}
    >
      <Icon size={14} aria-hidden="true" />
      {children}
    </DropdownMenu.Item>
  )
}
