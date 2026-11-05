import { TriangleAlert } from 'lucide-react'
import type { RequirementBadge } from '@renderer/requirementsView'
import './RequirementBadges.css'

const MAX_VISIBLE = 2

const STATE_TEXT = {
  met: 'installed',
  'not-deployed': 'not-deployed',
  missing: 'not installed'
} as const

interface RequirementBadgesProp {
  badges: RequirementBadge[]
}

export function RequirementBadges({ badges }: RequirementBadgesProp): React.JSX.Element {
  const shown = badges.slice(0, MAX_VISIBLE)
  const hidden = badges.slice(MAX_VISIBLE)
  const hiddenUnmet = hidden.some((badge) => badge.state !== 'met')

  return (
    <>
      {shown.map((badge) => (
        <span
          key={badge.key}
          className={badge.state === 'met' ? 'badge' : 'badge badge-unmet'}
          title={badge.title}
        >
          {badge.state !== 'met' && <TriangleAlert size={12} aria-hidden="true" />}
          {badge.label}
          <span className="sr-only">({STATE_TEXT[badge.state]})</span>
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          className={hiddenUnmet ? 'badge badge-unmet' : 'badge'}
          title={hidden.map((badge) => badge.title).join('\n')}
        >
          +{hidden.length}
          <span className="sr-only"> more: {hidden.map((badge) => badge.title).join(' ')}</span>
        </span>
      )}
    </>
  )
}
