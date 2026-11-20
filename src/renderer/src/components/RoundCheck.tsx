import { Circle, CircleCheck, CircleMinus } from 'lucide-react'
import type { CheckState } from '@renderer/selection'
import './RouncCheck.css'

const ICONS = { none: Circle, some: CircleMinus, all: CircleCheck }
const CHECKED = { none: false, some: 'mixed', all: true } as const

interface RoundCheckProps {
  state: CheckState
  label: string
  onToggle: () => void
}

export function RoundCheck({ state, label, onToggle }: RoundCheckProps): React.JSX.Element {
  const Icon = ICONS[state]

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={CHECKED[state]}
      aria-label={label}
      className={`round-check ${state}`}
      onClick={onToggle}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  )
}
