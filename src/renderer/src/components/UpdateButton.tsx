import { CircleArrowUp } from 'lucide-react'
import type { ModUpdate } from '@shared/types'
import { updateTitle } from '@renderer/updatesView'
import { useI18n } from '@renderer/i18n/context'
import './UpdateButton.css'

interface UpdateButtonProps {
  update: ModUpdate
  label: string
  onClick: () => void
}

export function UpdateButton({ update, label, onClick }: UpdateButtonProps): React.JSX.Element {
  const { t, language } = useI18n()
  const title = updateTitle(update, t, language)

  return (
    <button
      type="button"
      className="update-button"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      <CircleArrowUp size={12} aria-hidden="true" />
      {label}
    </button>
  )
}
