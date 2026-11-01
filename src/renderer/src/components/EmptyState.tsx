import type { LucideIcon } from 'lucide-react'
import './EmptyState.css'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  children?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, children }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="empty-state">
      <Icon size={32} aria-hidden="true" />
      <p className="empty-state-title">{title}</p>
      {children}
    </div>
  )
}
