import { TriangleAlert } from 'lucide-react'
import type { MessageKey } from '@shared/i18n/en'
import type { RequirementBadge, RequirementState } from '@renderer/requirementsView'
import { useT } from '@renderer/i18n/context'
import { insert } from '@renderer/i18n/insert'
import './RequirementBadges.css'

const MAX_VISIBLE = 2

const STATE_TEXT: Record<RequirementState, MessageKey> = {
  met: 'requirements.state.met',
  'not-deployed': 'requirements.state.notDeployed',
  missing: 'requirements.state.missing'
}

interface RequirementBadgesProp {
  badges: RequirementBadge[]
}

function isWarning(badge: RequirementBadge): boolean {
  return badge.state !== 'met' && !badge.optional
}

function badgeClass(warning: boolean): string {
  return warning ? 'badge requirement-badge badge-unmet' : 'badge requirement-badge'
}

export function RequirementBadges({ badges }: RequirementBadgesProp): React.JSX.Element {
  const t = useT()
  const shown = badges.slice(0, MAX_VISIBLE)
  const hidden = badges.slice(MAX_VISIBLE)
  const hiddenUnmet = hidden.some(isWarning)

  return (
    <>
      {shown.map((badge) => {
        const label = <span className="requirement-label">{badge.label}</span>

        return (
          <span key={badge.key} className={badgeClass(isWarning(badge))} title={badge.title}>
            {isWarning(badge) && <TriangleAlert size={12} aria-hidden="true" />}
            {badge.optional ? insert(t('requirements.optionalBadge'), { label }) : label}
            <span className="sr-only"> ({t(STATE_TEXT[badge.state])})</span>
          </span>
        )
      })}
      {hidden.length > 0 && (
        <span
          className={badgeClass(hiddenUnmet)}
          title={hidden.map((badge) => badge.title).join('\n')}
        >
          +{hidden.length}
          <span className="sr-only">
            {' '}
            {t('requirements.more', { titles: hidden.map((badge) => badge.title).join(' ') })}
          </span>
        </span>
      )}
    </>
  )
}
