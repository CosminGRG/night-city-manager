import { useT } from '@renderer/i18n/context'
import './TrashLeftoversOption.css'

interface TrashLeftoverOptionProps {
  checked: boolean
  hint: string
  onChange: (checked: boolean) => void
}

export function TrashLeftoversOption({
  checked,
  hint,
  onChange
}: TrashLeftoverOptionProps): React.JSX.Element {
  const t = useT()

  return (
    <label className="confirm-option">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {t('leftovers.trashOption')}
        <span className="muted">{hint}</span>
      </span>
    </label>
  )
}
